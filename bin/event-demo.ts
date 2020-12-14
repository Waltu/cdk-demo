#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { EventDemoStack } from '../lib/event-demo-stack';

const app = new cdk.App();
new EventDemoStack(app, 'EventDemoStack', {
    env: {
        account: process.env.CDK_DEFAULT_ACCOUNT,
        region: process.env.CDK_DEFAULT_REGION ,
      },
});
