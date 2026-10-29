import { FastifyInstance } from 'fastify';
import pg from 'pg';
import { EnvConfig } from './config/env.config.js';
export interface AppDependencies {
    pool?: pg.Pool;
}
export declare function buildApp(config: EnvConfig, dependencies?: AppDependencies): FastifyInstance;
//# sourceMappingURL=app.d.ts.map