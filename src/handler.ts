import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { nanoid } from 'nanoid';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.TABLE_NAME;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'OPTIONS,POST',
};

const jsonResponse = (statusCode: number, body: Record<string, unknown>): APIGatewayProxyResult => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    ...corsHeaders,
  },
  body: JSON.stringify(body),
});

const normalizeUrl = (value: unknown) => {
  if (typeof value !== 'string') return null;

  try {
    const parsed = new URL(value.trim());
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    return parsed.toString();
  } catch {
    return null;
  }
};

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const method = event.httpMethod || (event as any).requestContext?.http?.method;
    if (method === 'OPTIONS') {
      return {
        statusCode: 204,
        headers: corsHeaders,
        body: '',
      };
    }

    if (!TABLE_NAME) {
      return jsonResponse(500, { error: 'TABLE_NAME is not configured' });
    }

    if (!event.body) {
      return jsonResponse(400, { error: 'El cuerpo de la peticion es obligatorio' });
    }

    let payload: { url?: unknown };
    try {
      payload = JSON.parse(event.body);
    } catch {
      return jsonResponse(400, { error: 'El cuerpo de la peticion debe ser JSON valido' });
    }

    const originalUrl = normalizeUrl(payload.url);
    if (!originalUrl) {
      return jsonResponse(400, { error: 'La URL debe ser valida y usar http o https' });
    }

    const shortId = nanoid(6);
    const createdAt = new Date().toISOString();

    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          shortId,
          originalUrl,
          createdAt,
          clicks: 0,
          visits: [],
        },
        ConditionExpression: 'attribute_not_exists(shortId)',
      })
    );

    const redirectBaseUrl = process.env.REDIRECT_BASE_URL;
    const shortUrl = redirectBaseUrl
      ? `${redirectBaseUrl.replace(/\/$/, '')}/${shortId}`
      : `https://${event.requestContext.domainName || 'short.ly'}/${event.requestContext.stage || 'dev'}/${shortId}`;

    return jsonResponse(201, {
      message: 'URL acortada con exito',
      shortId,
      shortUrl,
      originalUrl,
    });
  } catch (error) {
    console.error('Error shortening URL:', error);
    return jsonResponse(500, {
      error: 'Error interno del servidor',
      details: (error as Error).message,
    });
  }
};
