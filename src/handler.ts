import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { nanoid } from 'nanoid';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.TABLE_NAME || 'url-shortener-urls-dev';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        console.log('Event received:', JSON.stringify(event));

        if (!event.body) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Falta el cuerpo de la petición' }),
            };
        }

        const { url } = JSON.parse(event.body);

        if (!url) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'La URL es obligatoria' }),
            };
        }

        // Generar ID único de 6 caracteres
        const shortId = nanoid(6);
        const createdAt = new Date().toISOString();

        // Guardar en DynamoDB
        const item = {
            shortId,
            originalUrl: url,
            createdAt,
            clicks: 0
        };

        await docClient.send(new PutCommand({
            TableName: TABLE_NAME,
            Item: item
        }));

        const domain = event.requestContext.domainName || 'short.ly';
        const stage = event.requestContext.stage || 'dev';
        const shortUrl = `https://${domain}/${stage}/${shortId}`;

        return {
            statusCode: 201,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*' // Habilitar CORS
            },
            body: JSON.stringify({
                message: 'URL acortada con éxito',
                shortId,
                shortUrl,
                originalUrl: url
            }),
        };
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                error: 'Error interno del servidor', 
                details: (error as Error).message 
            }),
        };
    }
};
