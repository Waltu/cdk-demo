import { DynamoDB } from 'aws-sdk';
import { APIGatewayProxyEventV2, APIGatewayProxyResultV2, DynamoDBStreamEvent } from 'aws-lambda';
import { v4 } from 'uuid';

const isTest = process.env.JEST_WORKER_ID;
const config = {
  convertEmptyValues: true,
  ...(isTest && {
    endpoint: 'localhost:8000',
    sslEnabled: false,
    region: 'local-env',
  }),
};

const dynamoClient = new DynamoDB.DocumentClient(config);

interface Event {
  type: string
  source: string
}

/**
 * Adds event to dynamoDB
 *
 * @param req APIGatewayProxyEventV2
 */
export async function add(req: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const { body } = req;

  if (!body) {
    return {
      statusCode: 400,
      body: 'Missing body'
    };
  }

  const { type, source } = JSON.parse(body) as Event;

  if (!type || !source) {
    return {
      statusCode: 400,
      body: 'Missing type and/or source'
    };
  }

  const id = v4();

  await dynamoClient.put({
    TableName: process.env.TABLE_NAME!,
    Item: {
      PartitionKey: source,
      SortKey: id,
      Timestamp: new Date().toISOString(),
      Type: type
    },
  }).promise();

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ id }),
  };
}

/**
 * Returns report by source
 *
 * @param req APIGatewayProxyEventV2
 */
export async function getReportBySource(req: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
    const source = req.queryStringParameters?.source;
    const day = req.queryStringParameters?.day

    if (!source && day) {
      return {
        statusCode: 400,
        body: 'Missing query parameters'
      }
    }

    const report = await dynamoClient.get({
      TableName: process.env.TABLE_NAME!,
      Key: {
        PartitionKey: source,
        SortKey: day
      },
    }).promise();

    let response = {
      day: day,
      viewCount: report.Item?.ViewCount || 0
    };
  
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(response),
    };
  }

    /**
   * Updates or creates aggregated items in chunck for faster analytics
   *
   * @param event
   */
  export async function updateAggregation(event: DynamoDBStreamEvent) {
    const updates = event.Records.filter(r => r.eventName === "INSERT").map(async (record) => {
      const day = new Date(record.dynamodb?.NewImage?.Timestamp.S as string).toISOString().slice(0,10);

      const aggregatedResult = await dynamoClient.get({
        TableName: process.env.TABLE_NAME!,
        Key: {
          PartitionKey: record.dynamodb?.NewImage?.PartitionKey.S,
          SortKey: day
        },
      }).promise()

      let viewCount = 1;

      // Create aggregation row if it doesn't exists
      // TODO: Replace update to use atomic counter
      if (!aggregatedResult.Item) {
        await dynamoClient.put({
          TableName: process.env.TABLE_NAME!,
          Item: {
            PartitionKey: record.dynamodb?.NewImage?.PartitionKey.S,
            SortKey: day,
            ViewCount: viewCount,
          },
        }).promise();
      } else {
        viewCount = aggregatedResult.Item.ViewCount + 1;
      }
      
      const update = dynamoClient.update({
        TableName: process.env.TABLE_NAME!,
        Key: {
          PartitionKey: record.dynamodb?.NewImage?.PartitionKey.S,
          SortKey: day
        },
        UpdateExpression: "SET ViewCount = :viewCount",
        ExpressionAttributeValues: {
          ":viewCount": viewCount
        }
      }).promise();

      return update;
    });

    await Promise.all(updates);
  }
