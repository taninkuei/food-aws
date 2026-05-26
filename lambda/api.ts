import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';

const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const ddb = DynamoDBDocumentClient.from(client);
const TABLE = process.env.TABLE_NAME!;
const API_KEY = process.env.API_KEY!;

function resp(statusCode: number, body: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify(body),
  };
}

function requireApiKey(event: APIGatewayProxyEventV2): boolean {
  const key = event.headers?.['x-api-key'];
  return key === API_KEY;
}

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  const method = event.requestContext.http.method;
  const path = event.requestContext.http.path;

  // POST /entries — write endpoint, requires API key
  if (method === 'POST' && path === '/entries') {
    if (!requireApiKey(event)) return resp(401, { error: 'Unauthorized' });
    let body: any;
    try { body = JSON.parse(event.body || '{}'); } catch { return resp(400, { error: 'Invalid JSON' }); }

    const now = new Date();
    const date = body.date || now.toISOString().slice(0, 10);
    const entryId = uuidv4();
    const entry = {
      date,
      entryId,
      timestamp: body.timestamp || now.toISOString(),
      meal: body.meal || 'snack',
      description: body.description || '',
      calories: Number(body.calories) || 0,
      protein: Number(body.protein) || 0,
      carbs: Number(body.carbs) || 0,
      fat: Number(body.fat) || 0,
      sugar: Number(body.sugar) || 0,
      sodium: Number(body.sodium) || 0,
      ...(body.notes ? { notes: body.notes } : {}),
    };

    await ddb.send(new PutCommand({ TableName: TABLE, Item: entry }));
    return resp(201, entry);
  }

  // GET /entries?date=YYYY-MM-DD
  if (method === 'GET' && path === '/entries') {
    const date = event.queryStringParameters?.date || new Date().toISOString().slice(0, 10);
    const result = await ddb.send(new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: '#d = :date',
      ExpressionAttributeNames: { '#d': 'date' },
      ExpressionAttributeValues: { ':date': date },
    }));
    return resp(200, { date, entries: result.Items || [] });
  }

  // DELETE /entries/{entryId}?date=YYYY-MM-DD
  if (method === 'DELETE' && path.startsWith('/entries/')) {
    if (!requireApiKey(event)) return resp(401, { error: 'Unauthorized' });
    const entryId = path.split('/')[2];
    const date = event.queryStringParameters?.date;
    if (!date) return resp(400, { error: 'date query param required' });
    await ddb.send(new DeleteCommand({ TableName: TABLE, Key: { date, entryId } }));
    return resp(200, { deleted: true });
  }

  // GET /summary?days=N
  if (method === 'GET' && path === '/summary') {
    const days = Math.min(parseInt(event.queryStringParameters?.days || '7'), 30);
    const dates: string[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dates.push(d.toISOString().slice(0, 10));
    }

    const summaries = await Promise.all(dates.map(async (date) => {
      const result = await ddb.send(new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: '#d = :date',
        ExpressionAttributeNames: { '#d': 'date' },
        ExpressionAttributeValues: { ':date': date },
      }));
      const entries = result.Items || [];
      return {
        date,
        totalCalories: entries.reduce((s: number, e: any) => s + (e.calories || 0), 0),
        totalProtein: entries.reduce((s: number, e: any) => s + (e.protein || 0), 0),
        totalCarbs: entries.reduce((s: number, e: any) => s + (e.carbs || 0), 0),
        totalFat: entries.reduce((s: number, e: any) => s + (e.fat || 0), 0),
        entryCount: entries.length,
      };
    }));

    return resp(200, { days, summaries });
  }

  return resp(404, { error: 'Not found' });
};
