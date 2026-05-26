import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigatewayv2_integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as cloudfront_origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface FoodStackProps extends cdk.StackProps {
  apiKey: string;
}

export class FoodStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: FoodStackProps) {
    super(scope, id, props);

    // DynamoDB table — PK=date, SK=entryId
    const table = new dynamodb.Table(this, 'FoodTable', {
      tableName: 'FoodEntries',
      partitionKey: { name: 'date', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'entryId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Lambda function — pre-bundled via lambda/dist/api.js
    const fn = new lambda.Function(this, 'FoodHandler', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'api.handler',
      code: lambda.Code.fromAsset('../lambda/dist'),
      environment: {
        TABLE_NAME: table.tableName,
        API_KEY: props.apiKey,
      },
      timeout: cdk.Duration.seconds(30),
    });

    table.grantReadWriteData(fn);

    // API Gateway v2
    const httpApi = new apigatewayv2.HttpApi(this, 'FoodApi', {
      corsPreflight: {
        allowOrigins: ['*'],
        allowMethods: [
          apigatewayv2.CorsHttpMethod.GET,
          apigatewayv2.CorsHttpMethod.POST,
          apigatewayv2.CorsHttpMethod.DELETE,
          apigatewayv2.CorsHttpMethod.OPTIONS,
        ],
        allowHeaders: ['Content-Type', 'x-api-key'],
      },
    });

    const integration = new apigatewayv2_integrations.HttpLambdaIntegration(
      'FoodIntegration',
      fn,
    );

    httpApi.addRoutes({
      path: '/entries',
      methods: [apigatewayv2.HttpMethod.GET, apigatewayv2.HttpMethod.POST],
      integration,
    });

    httpApi.addRoutes({
      path: '/entries/{entryId}',
      methods: [apigatewayv2.HttpMethod.DELETE],
      integration,
    });

    httpApi.addRoutes({
      path: '/summary',
      methods: [apigatewayv2.HttpMethod.GET],
      integration,
    });

    // S3 bucket for frontend
    const siteBucket = new s3.Bucket(this, 'FoodSiteBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // OAC for CloudFront → S3
    const oac = new cloudfront.S3OriginAccessControl(this, 'FoodOAC', {
      signing: cloudfront.Signing.SIGV4_NO_OVERRIDE,
    });

    const distribution = new cloudfront.Distribution(this, 'FoodDistribution', {
      defaultBehavior: {
        origin: cloudfront_origins.S3BucketOrigin.withOriginAccessControl(siteBucket, {
          originAccessControl: oac,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        { httpStatus: 403, responseHttpStatus: 200, responsePagePath: '/index.html' },
        { httpStatus: 404, responseHttpStatus: 200, responsePagePath: '/index.html' },
      ],
    });

    siteBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        actions: ['s3:GetObject'],
        resources: [`${siteBucket.bucketArn}/*`],
        principals: [new iam.ServicePrincipal('cloudfront.amazonaws.com')],
        conditions: {
          StringEquals: {
            'AWS:SourceArn': `arn:aws:cloudfront::${this.account}:distribution/${distribution.distributionId}`,
          },
        },
      }),
    );

    new cdk.CfnOutput(this, 'ApiUrl', { value: httpApi.apiEndpoint });
    new cdk.CfnOutput(this, 'BucketName', { value: siteBucket.bucketName });
    new cdk.CfnOutput(this, 'CloudFrontDomain', { value: distribution.distributionDomainName });
    new cdk.CfnOutput(this, 'CloudFrontDistributionId', { value: distribution.distributionId });
  }
}
