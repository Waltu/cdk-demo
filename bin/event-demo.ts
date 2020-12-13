#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { EventDemoStack } from '../lib/event-demo-stack';

const app = new cdk.App();
new EventDemoStack(app, 'EventDemoStack');
