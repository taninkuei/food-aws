#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { FoodStack } from '../lib/food-stack';

const app = new cdk.App();

const apiKey = app.node.tryGetContext('apiKey') as string;
if (!apiKey) {
  throw new Error('Pass -c apiKey=<value>');
}

new FoodStack(app, 'FoodStack', {
  env: {
    account: '585546485067',
    region: 'ap-northeast-1',
  },
  apiKey,
});
