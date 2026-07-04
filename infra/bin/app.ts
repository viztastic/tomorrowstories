#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { TomorrowStoriesStack } from "../lib/tomorrow-stories-stack";

const app = new cdk.App();

new TomorrowStoriesStack(app, "TomorrowStories", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
  description: "Tomorrow Stories — conference video wall (attendee + big screen)",
});
