import { FastifyRequest, FastifyReply } from 'fastify';
import { PostTransactionUseCase } from '../../usecases/post-transaction.usecase.js';
import { ReverseTransactionUseCase } from '../../usecases/reverse-transaction.usecase.js';
import { GetAccountBalanceUseCase } from '../../usecases/get-balance.usecase.js';
import { LedgerPresenter } from '../presenters/ledger.presenter.js';
import {
  UnbalancedTransactionError,
  InsufficientFundsError,
  AccountFrozenError,
  AccountNotFoundError,
  DuplicateTransactionError,
} from '../../domain/exceptions/ledger.exceptions.js';

interface PostTransactionBody {
  description: string;
  entries: {
    accountId: string;
    direction: 'DEBIT' | 'CREDIT';
    amount: string;
    currency: string;
    description?: string;
  }[];
}

interface ReverseTransactionBody {
  reason: string;
}

export class TransactionController {
  constructor(
    private readonly postTransactionUseCase: PostTransactionUseCase,
    private readonly reverseTransactionUseCase: ReverseTransactionUseCase,
    private readonly getAccountBalanceUseCase: GetAccountBalanceUseCase
  ) {}

  public postTransaction = async (
    request: FastifyRequest<{
      Body: PostTransactionBody;
      Headers: { 'idempotency-key'?: string };
    }>,
    reply: FastifyReply
  ): Promise<void> => {
    const idempotencyKey = request.headers['idempotency-key'];
    if (!idempotencyKey || typeof idempotencyKey !== 'string') {
      reply.status(400).send(
        LedgerPresenter.toError('MISSING_IDEMPOTENCY_KEY', 'Header "Idempotency-Key" is required for financial transactions.')
      );
      return;
    }

    const { description, entries } = request.body;

    const result = await this.postTransactionUseCase.execute({
      idempotencyKey,
      description,
      entries,
    });

    if (result.isFailure) {
      const err = result.getError();
      const status = this.mapErrorToStatusCode(err);
      reply.status(status).send(
        LedgerPresenter.toError(
          (err as { code?: string }).code ?? 'TRANSACTION_EXECUTION_FAILED',
          err.message
        )
      );
      return;
    }

    reply.status(201).send(LedgerPresenter.toSuccess(result.getValue()));
  };

  public reverseTransaction = async (
    request: FastifyRequest<{
      Params: { id: string };
      Body: ReverseTransactionBody;
      Headers: { 'idempotency-key'?: string };
    }>,
    reply: FastifyReply
  ): Promise<void> => {
    const idempotencyKey = request.headers['idempotency-key'];
    if (!idempotencyKey || typeof idempotencyKey !== 'string') {
      reply.status(400).send(
        LedgerPresenter.toError('MISSING_IDEMPOTENCY_KEY', 'Header "Idempotency-Key" is required for reversal transactions.')
      );
      return;
    }

    const { id: transactionId } = request.params;
    const { reason } = request.body;

    const result = await this.reverseTransactionUseCase.execute({
      transactionId,
      reversalIdempotencyKey: idempotencyKey,
      reason: reason || `Reversal requested for transaction ${transactionId}`,
    });

    if (result.isFailure) {
      const err = result.getError();
      const status = this.mapErrorToStatusCode(err);
      reply.status(status).send(
        LedgerPresenter.toError(
          (err as { code?: string }).code ?? 'REVERSAL_EXECUTION_FAILED',
          err.message
        )
      );
      return;
    }

    reply.status(200).send(LedgerPresenter.toSuccess(result.getValue()));
  };

  public getBalance = async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<void> => {
    const { id: accountId } = request.params;

    const result = await this.getAccountBalanceUseCase.execute({ accountId });

    if (result.isFailure) {
      const err = result.getError();
      const status = this.mapErrorToStatusCode(err);
      reply.status(status).send(
        LedgerPresenter.toError(
          (err as { code?: string }).code ?? 'BALANCE_LOOKUP_FAILED',
          err.message
        )
      );
      return;
    }

    reply.status(200).send(LedgerPresenter.toSuccess(result.getValue()));
  };

  private mapErrorToStatusCode(err: Error): number {
    if (err instanceof UnbalancedTransactionError) return 422;
    if (err instanceof InsufficientFundsError) return 422;
    if (err instanceof AccountFrozenError) return 403;
    if (err instanceof AccountNotFoundError) return 404;
    if (err instanceof DuplicateTransactionError) return 409;
    if (err.message.includes('Concurrent request')) return 409;
    return 500;
  }
}
