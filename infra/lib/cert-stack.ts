import { Stack, StackProps, CfnOutput } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as route53 from "aws-cdk-lib/aws-route53";

export interface CertStackProps extends StackProps {
  /** Apex domain, e.g. "tomorrowstories.net". */
  domainName: string;
  /** Existing Route 53 hosted zone id for the apex domain. */
  hostedZoneId: string;
}

/**
 * CloudFront requires its ACM certificate in us-east-1, so the cert lives in its
 * own stack pinned to that region — separate from the main app stack (Sydney).
 *
 * The cert covers the apex and www, and is DNS-validated automatically against
 * the existing hosted zone (CDK writes the validation CNAMEs for us). Validation
 * only completes once the domain's nameservers point at this Route 53 zone, so
 * deploy this after the GoDaddy → Route 53 nameserver switch has propagated.
 *
 * The ARN is emitted as an output; deploy.sh feeds it to the main stack, which
 * references the cert by ARN (a plain string works across regions with no
 * cross-region-reference plumbing).
 */
export class TomorrowStoriesCertStack extends Stack {
  constructor(scope: Construct, id: string, props: CertStackProps) {
    super(scope, id, props);

    const zone = route53.HostedZone.fromHostedZoneAttributes(this, "Zone", {
      hostedZoneId: props.hostedZoneId,
      zoneName: props.domainName,
    });

    const certificate = new acm.Certificate(this, "SiteCert", {
      domainName: props.domainName,
      subjectAlternativeNames: [`www.${props.domainName}`],
      validation: acm.CertificateValidation.fromDns(zone),
    });

    new CfnOutput(this, "CertificateArn", { value: certificate.certificateArn });
  }
}
