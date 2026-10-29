import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { TransactionController } from './transaction.controller.js';

export function createTransactionRouter(controller: TransactionController): FastifyPluginAsync {
  return async (fastify: FastifyInstance): Promise<void> => {
    // 1. Post a new Double-entry Transaction
    fastify.post(
      '/transactions',
      {
        schema: {
          headers: {
            type: 'object',
            properties: {
              'idempotency-key': { type: 'string', minLength: 1 },
            },
            required: ['idempotency-key'],
          },
          body: {
            type: 'object',
            required: ['description', 'entries'],
            properties: {
              description: { type: 'string', minLength: 1 },
              entries: {
                type: 'array',
                minItems: 2,
                items: {
                  type: 'object',
                  required: ['accountId', 'direction', 'amount', 'currency'],
                  properties: {
                    accountId: { type: 'string', minLength: 1 },
                    direction: { type: 'string', enum: ['DEBIT', 'CREDIT'] },
                    amount: { type: 'string', minLength: 1 },
                    currency: { type: 'string', minLength: 3, maxLength: 5 },
                    description: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
      controller.postTransaction
    );

    // 2. Reverse an existing Transaction (Append-Only Reversal)
    fastify.post(
      '/transactions/:id/reversal',
      {
        schema: {
          params: {
            type: 'object',
            required: ['id'],
            properties: {
              id: { type: 'string', minLength: 1 },
            },
          },
          headers: {
            type: 'object',
            properties: {
              'idempotency-key': { type: 'string', minLength: 1 },
            },
            required: ['idempotency-key'],
          },
          body: {
            type: 'object',
            required: ['reason'],
            properties: {
              reason: { type: 'string', minLength: 1 },
            },
          },
        },
      },
      controller.reverseTransaction
    );

    // 3. Query Account Balance
    fastify.get(
      '/accounts/:id/balance',
      {
        schema: {
          params: {
            type: 'object',
            required: ['id'],
            properties: {
              id: { type: 'string', minLength: 1 },
            },
          },
        },
      },
      controller.getBalance
    );
  };
}
