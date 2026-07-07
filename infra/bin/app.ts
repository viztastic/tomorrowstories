#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { TomorrowStoriesStack } from "../lib/tomorrow-stories-stack";
import { TomorrowStoriesCertStack } from "../lib/cert-stack";

const app = new cdk.App();

const account = process.env.CDK_DEFAULT_ACCOUNT;
const region = process.env.CDK_DEFAULT_REGION;

// Custom-domain mode is opt-in via env (set by deploy.sh). Without it the stack
// deploys exactly as before on the default *.cloudfront.net domain, so demo /
// non-prod deploys are unaffected.
const domainName = process.env.DOMAIN_NAME || "";
const hostedZoneId = process.env.HOSTED_ZONE_ID || "";
const certificateArn = process.env.CERT_ARN || "";

// The cert must live in us-east-1 for CloudFront. It's only needed (and only
// instantiated) in custom-domain mode; deploy.sh deploys it first, then feeds
// its ARN back in via CERT_ARN for the main stack.
if (domainName && hostedZoneId) {
  new TomorrowStoriesCertStack(app, "TomorrowStoriesCert", {
    env: { account, region: "us-east-1" },
    crossRegionReferences: true,
    domainName,
    hostedZoneId,
    description: "Tomorrow Stories — CloudFront TLS certificate (us-east-1)",
  });
}

new TomorrowStoriesStack(app, "TomorrowStories", {
  env: { account, region },
  description: "Tomorrow Stories — conference video wall (attendee + big screen)",
  domainName,
  hostedZoneId,
  certificateArn,
});
