import * as path from "node:path";
import {
  Stack,
  StackProps,
  Duration,
  RemovalPolicy,
  CfnOutput,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3n from "aws-cdk-lib/aws-s3-notifications";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { NodejsFunction, OutputFormat } from "aws-cdk-lib/aws-lambda-nodejs";
import * as apigw from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import { BucketDeployment, Source } from "aws-cdk-lib/aws-s3-deployment";

const repoRoot = path.join(__dirname, "..", "..");
const backendDir = path.join(repoRoot, "backend");
const backendSrc = path.join(backendDir, "src");
const backendLock = path.join(backendDir, "package-lock.json");

export class TomorrowStoriesStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // ---------------------------------------------------------------- storage
    const table = new dynamodb.Table(this, "Table", {
      partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "SK", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      // Keep event/video metadata across redeploys and even a `cdk destroy`;
      // PITR adds continuous backups so nothing is lost to an accidental wipe.
      removalPolicy: RemovalPolicy.RETAIN,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
    });

    // Phone originals land here via presigned POST, then get transcoded.
    const rawBucket = new s3.Bucket(this, "RawUploads", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.POST],
          allowedOrigins: ["*"],
          allowedHeaders: ["*"],
          maxAge: 3000,
        },
      ],
      lifecycleRules: [{ expiration: Duration.days(3) }], // originals not needed after transcode
    });

    // Transcoded 720p MP4 + poster (or, in no-transcode mode, the originals).
    // Served through CloudFront. CORS allows the browser's direct presigned POST
    // used by no-transcode mode.
    const mediaBucket = new s3.Bucket(this, "Media", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      // Note: media objects already survive normal redeploys (an update never
      // deletes this bucket). We deliberately keep DESTROY + autoDeleteObjects
      // rather than flipping to RETAIN: with the CloudFront OAC bucket policy in
      // place, removing autoDeleteObjects makes CloudFormation strip the
      // provider's bucket-policy grant *before* deleting the auto-delete custom
      // resource, so its onDelete GetBucketTagging 403s and rolls the deploy
      // back. The durable metadata (which clip belongs to which event) lives in
      // DynamoDB, which is RETAIN + PITR above.
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.POST],
          allowedOrigins: ["*"],
          allowedHeaders: ["*"],
          maxAge: 3000,
        },
      ],
    });

    // Built React SPA.
    const webBucket = new s3.Bucket(this, "Web", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // ------------------------------------------------------------- CloudFront
    // default -> SPA, /media/* -> processed videos. One domain fronts both, so
    // SITE_BASE_URL and MEDIA_BASE_URL are the same origin.
    const distribution = new cloudfront.Distribution(this, "Cdn", {
      defaultRootObject: "index.html",
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(webBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      additionalBehaviors: {
        "/media/*": {
          origin: origins.S3BucketOrigin.withOriginAccessControl(mediaBucket),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        },
      },
      // SPA fallback: client-side routes (/e/<id>) resolve to index.html.
      errorResponses: [
        { httpStatus: 403, responseHttpStatus: 200, responsePagePath: "/index.html", ttl: Duration.minutes(1) },
        { httpStatus: 404, responseHttpStatus: 200, responsePagePath: "/index.html", ttl: Duration.minutes(1) },
      ],
    });

    const siteBaseUrl = `https://${distribution.distributionDomainName}`;

    // ---------------------------------------------------- MediaConvert IAM role
    const mediaConvertRole = new iam.Role(this, "MediaConvertRole", {
      assumedBy: new iam.ServicePrincipal("mediaconvert.amazonaws.com"),
    });
    rawBucket.grantRead(mediaConvertRole);
    mediaBucket.grantWrite(mediaConvertRole);

    // ------------------------------------------------------------- Lambdas
    const commonEnv = {
      TABLE_NAME: table.tableName,
      RAW_BUCKET: rawBucket.bucketName,
      MEDIA_BUCKET: mediaBucket.bucketName,
      MEDIA_BASE_URL: siteBaseUrl,
      SITE_BASE_URL: siteBaseUrl,
    };
    // CommonJS output: bundling the AWS SDK v3 as ESM triggers runtime
    // "Dynamic require of X is not supported" crashes on cold start. CJS is safe.
    const bundling = { format: OutputFormat.CJS, target: "node20", externalModules: [] as string[] };
    const fnDefaults = {
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 256,
      timeout: Duration.seconds(20),
      bundling,
      projectRoot: repoRoot,
      depsLockFilePath: backendLock,
    };

    const apiFn = new NodejsFunction(this, "ApiFn", {
      ...fnDefaults,
      entry: path.join(backendSrc, "api.ts"),
      // ADMIN_PASSWORD guards /admin/events; empty string disables the console.
      // TRANSCODE=off makes uploads skip MediaConvert and serve originals.
      environment: {
        ...commonEnv,
        ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || "",
        TRANSCODE: process.env.TRANSCODE || "on",
      },
    });
    table.grantReadWriteData(apiFn);
    rawBucket.grantPut(apiFn); // presigned POST is signed with the Lambda's creds
    mediaBucket.grantPut(apiFn); // no-transcode mode uploads straight to media
    // Admin "delete event" enumerates + removes that event's raw/media objects.
    apiFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["s3:ListBucket", "s3:DeleteObject"],
        resources: [
          rawBucket.bucketArn,
          rawBucket.arnForObjects("*"),
          mediaBucket.bucketArn,
          mediaBucket.arnForObjects("*"),
        ],
      })
    );

    const onRawUploadFn = new NodejsFunction(this, "OnRawUploadFn", {
      ...fnDefaults,
      timeout: Duration.seconds(30),
      entry: path.join(backendSrc, "onRawUpload.ts"),
      environment: {
        ...commonEnv,
        MEDIACONVERT_ROLE_ARN: mediaConvertRole.roleArn,
      },
    });
    rawBucket.grantRead(onRawUploadFn);
    table.grantWriteData(onRawUploadFn); // so it can mark a clip "failed" if the job can't start
    onRawUploadFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["mediaconvert:CreateJob", "mediaconvert:DescribeEndpoints"],
        resources: ["*"],
      })
    );
    onRawUploadFn.addToRolePolicy(
      new iam.PolicyStatement({ actions: ["iam:PassRole"], resources: [mediaConvertRole.roleArn] })
    );
    rawBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(onRawUploadFn),
      { prefix: "raw/" }
    );

    const onTranscodeDoneFn = new NodejsFunction(this, "OnTranscodeDoneFn", {
      ...fnDefaults,
      entry: path.join(backendSrc, "onTranscodeDone.ts"),
      environment: commonEnv,
    });
    table.grantReadWriteData(onTranscodeDoneFn);
    new events.Rule(this, "TranscodeDoneRule", {
      eventPattern: {
        source: ["aws.mediaconvert"],
        detailType: ["MediaConvert Job State Change"],
        detail: { status: ["COMPLETE", "ERROR"] },
      },
      targets: [new targets.LambdaFunction(onTranscodeDoneFn)],
    });

    // ------------------------------------------------------------- HTTP API
    const httpApi = new apigw.HttpApi(this, "Api", {
      corsPreflight: {
        allowOrigins: ["*"],
        allowMethods: [apigw.CorsHttpMethod.GET, apigw.CorsHttpMethod.POST, apigw.CorsHttpMethod.DELETE, apigw.CorsHttpMethod.OPTIONS],
        allowHeaders: ["content-type", "x-admin-key"],
      },
    });
    const integration = new HttpLambdaIntegration("ApiIntegration", apiFn);
    const routes: [apigw.HttpMethod, string][] = [
      [apigw.HttpMethod.POST, "/events"],
      [apigw.HttpMethod.GET, "/admin/events"],
      [apigw.HttpMethod.GET, "/join/{code}"],
      [apigw.HttpMethod.GET, "/events/{eventId}"],
      [apigw.HttpMethod.DELETE, "/events/{eventId}"],
      [apigw.HttpMethod.POST, "/events/{eventId}/uploads"],
      [apigw.HttpMethod.GET, "/events/{eventId}/videos"],
      [apigw.HttpMethod.POST, "/events/{eventId}/videos/{videoId}/like"],
    ];
    for (const [methodEnum, routePath] of routes) {
      httpApi.addRoutes({ path: routePath, methods: [methodEnum], integration });
    }
    const apiUrl = httpApi.apiEndpoint;

    // ---------------- runtime config for the SPA (decouples build from deploy)
    // Written without pruning so it coexists with the `aws s3 sync` of the build.
    new BucketDeployment(this, "WebConfig", {
      destinationBucket: webBucket,
      prune: false,
      distribution,
      distributionPaths: ["/config.json"],
      sources: [Source.jsonData("config.json", { apiUrl })],
    });

    // ------------------------------------------------------------- outputs
    new CfnOutput(this, "SiteUrl", { value: siteBaseUrl });
    new CfnOutput(this, "ApiUrl", { value: apiUrl });
    new CfnOutput(this, "WebBucketName", { value: webBucket.bucketName });
    new CfnOutput(this, "DistributionId", { value: distribution.distributionId });
    new CfnOutput(this, "TableName", { value: table.tableName });
  }
}
