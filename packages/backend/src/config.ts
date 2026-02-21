import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export const config = {
  port: parseInt(process.env.PORT ?? '3000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',

  db: {
    host: process.env.DB_HOST ?? '127.0.0.1',
    port: parseInt(process.env.DB_PORT ?? '13306', 10),
    user: process.env.DB_USER ?? 'root',
    password: process.env.DB_PASSWORD ?? 'root_dev',
    database: process.env.DB_NAME ?? 'lucidreview',
  },

  hapiFhir: {
    baseUrl: process.env.HAPI_FHIR_URL ?? 'http://localhost:8080/fhir',
  },

  ctakes: {
    baseUrl: process.env.CTAKES_URL ?? 'http://localhost:8081',
  },

  bedrock: {
    region: process.env.AWS_REGION ?? 'us-east-1',
    modelId: process.env.BEDROCK_MODEL_ID ?? 'us.anthropic.claude-sonnet-4-6',
  },

  mcpServer: {
    path: process.env.MCP_SERVER_PATH
      ?? resolve(__dirname, '../../mcp-server/dist/index.js'),
  },

  redis: {
    url: process.env.REDIS_URL ?? 'redis://localhost:6379',
  },

  jwtSecret: process.env.JWT_SECRET ?? 'lucidreview-dev-secret-change-in-prod',
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173').split(',').map(s => s.trim()),
} as const;
