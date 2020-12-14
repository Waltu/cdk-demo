import * as cdk from '@aws-cdk/core';
import * as dynamodb from '@aws-cdk/aws-dynamodb';
import * as lambda from '@aws-cdk/aws-lambda';
import * as lambdaNode from '@aws-cdk/aws-lambda-nodejs';
import * as apiGW from '@aws-cdk/aws-apigatewayv2';
import * as apiGWIntegrations from "@aws-cdk/aws-apigatewayv2-integrations";
import { DynamoEventSource, SqsDlq } from '@aws-cdk/aws-lambda-event-sources';
import { StreamViewType } from '@aws-cdk/aws-dynamodb';
import { RemovalPolicy } from '@aws-cdk/core';


export class EventDemoStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const eventTable = new dynamodb.Table(this, 'Event', {
      tableName: "Event",
      partitionKey: {
        name: 'PartitionKey',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: "SortKey",
        type: dynamodb.AttributeType.STRING
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      stream: StreamViewType.NEW_IMAGE,
      removalPolicy: RemovalPolicy.DESTROY
    });

    new cdk.CfnOutput(this, 'eventTableName', {value: eventTable.tableName});

    const postFunction = new lambdaNode.NodejsFunction(this, 'AddFunction', {
      runtime: lambda.Runtime.NODEJS_12_X,
      handler: 'add',
      entry: __dirname + '/../lambda/lib/events.ts',
      environment: {
        TABLE_NAME: eventTable.tableName,
      },
    });

    eventTable.grantReadWriteData(postFunction);

    const updateAggregation = new lambdaNode.NodejsFunction(this, 'UpdateAggregation', {
      runtime: lambda.Runtime.NODEJS_12_X,
      handler: 'updateAggregation',
      entry: __dirname + '/../lambda/lib/events.ts',
      environment: {
        TABLE_NAME: eventTable.tableName,
      },
    });

    updateAggregation.addEventSource(new DynamoEventSource(eventTable, {
      startingPosition: lambda.StartingPosition.TRIM_HORIZON,
      batchSize: 5,
      bisectBatchOnError: true,
      retryAttempts: 1
    }));

    eventTable.grantReadWriteData(updateAggregation);
    
    const getFunction = new lambdaNode.NodejsFunction(this, 'GetReportFunction', {
      runtime: lambda.Runtime.NODEJS_12_X,
      handler: 'getReportBySource',
      entry: __dirname + '/../lambda/lib/events.ts',
      environment: {
        TABLE_NAME: eventTable.tableName,
      },
    });
 
    eventTable.grantReadData(getFunction);

    const api = new apiGW.HttpApi(this, 'EventAPI');
    new cdk.CfnOutput(this, 'ApiUrl', {value: api.url!});

    api.addRoutes({
      path: '/events',
      methods: [apiGW.HttpMethod.POST],
      integration: new apiGWIntegrations.LambdaProxyIntegration({handler: postFunction})
    });

    api.addRoutes({
      path: '/events/reports',
      methods: [apiGW.HttpMethod.GET],
      integration: new apiGWIntegrations.LambdaProxyIntegration({handler: getFunction})
    });
  }
}