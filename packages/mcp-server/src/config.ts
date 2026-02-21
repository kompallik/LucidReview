export const config = {
  umSystem: {
    baseUrl: process.env.UM_SYSTEM_BASE_URL ?? 'http://mock-um-system',
    apiKey: process.env.UM_SYSTEM_API_KEY ?? 'mock-key',
    timeout: 15_000,
  },
  hapiFhir: {
    baseUrl: process.env.HAPI_FHIR_URL ?? 'http://localhost:8080/fhir',
  },
  ctakes: {
    url: process.env.CTAKES_URL ?? 'http://localhost:8081',
  },
  database: {
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '13306'),
    user: process.env.DB_USER ?? 'root',
    password: process.env.DB_PASSWORD ?? 'root_dev',
    database: process.env.DB_NAME ?? 'lucidreview',
  },
};
