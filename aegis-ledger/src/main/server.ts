import { loadEnvConfig } from './config/env.config.js';
import { buildApp } from './app.js';
import { PostgresPool } from '../ledger/infrastructure/database/postgres-pool.js';

async function bootstrap(): Promise<void> {
  const config = loadEnvConfig();
  const app = buildApp(config);

  const shutdown = async (signal: string): Promise<void> => {
    app.log.info(`Received ${signal}. Gracefully shutting down AegisLedger Engine...`);
    try {
      await app.close();
      await PostgresPool.close();
      app.log.info('AegisLedger Engine shutdown completed cleanly.');
      process.exit(0);
    } catch (err) {
      app.log.error({ err }, 'Error during shutdown');
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  try {
    const address = await app.listen({ port: config.PORT, host: config.HOST });
    app.log.info(`🚀 AegisLedger Engine running at: ${address}`);
  } catch (err) {
    app.log.fatal({ err }, 'Fatal error during startup');
    process.exit(1);
  }
}

bootstrap().catch((err) => {
  console.error('Unhandled bootstrap rejection:', err);
  process.exit(1);
});
