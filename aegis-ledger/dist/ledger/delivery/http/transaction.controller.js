import { LedgerPresenter } from '../presenters/ledger.presenter.js';
import { UnbalancedTransactionError, InsufficientFundsError, AccountFrozenError, AccountNotFoundError, DuplicateTransactionError, } from '../../domain/exceptions/ledger.exceptions.js';
export class TransactionController {
    postTransactionUseCase;
    reverseTransactionUseCase;
    getAccountBalanceUseCase;
    constructor(postTransactionUseCase, reverseTransactionUseCase, getAccountBalanceUseCase) {
        this.postTransactionUseCase = postTransactionUseCase;
        this.reverseTransactionUseCase = reverseTransactionUseCase;
        this.getAccountBalanceUseCase = getAccountBalanceUseCase;
    }
    postTransaction = async (request, reply) => {
        const idempotencyKey = request.headers['idempotency-key'];
        if (!idempotencyKey || typeof idempotencyKey !== 'string') {
            reply.status(400).send(LedgerPresenter.toError('MISSING_IDEMPOTENCY_KEY', 'Header "Idempotency-Key" is required for financial transactions.'));
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
            reply.status(status).send(LedgerPresenter.toError(err.code ?? 'TRANSACTION_EXECUTION_FAILED', err.message));
            return;
        }
        reply.status(201).send(LedgerPresenter.toSuccess(result.getValue()));
    };
    reverseTransaction = async (request, reply) => {
        const idempotencyKey = request.headers['idempotency-key'];
        if (!idempotencyKey || typeof idempotencyKey !== 'string') {
            reply.status(400).send(LedgerPresenter.toError('MISSING_IDEMPOTENCY_KEY', 'Header "Idempotency-Key" is required for reversal transactions.'));
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
            reply.status(status).send(LedgerPresenter.toError(err.code ?? 'REVERSAL_EXECUTION_FAILED', err.message));
            return;
        }
        reply.status(200).send(LedgerPresenter.toSuccess(result.getValue()));
    };
    getBalance = async (request, reply) => {
        const { id: accountId } = request.params;
        const result = await this.getAccountBalanceUseCase.execute({ accountId });
        if (result.isFailure) {
            const err = result.getError();
            const status = this.mapErrorToStatusCode(err);
            reply.status(status).send(LedgerPresenter.toError(err.code ?? 'BALANCE_LOOKUP_FAILED', err.message));
            return;
        }
        reply.status(200).send(LedgerPresenter.toSuccess(result.getValue()));
    };
    mapErrorToStatusCode(err) {
        if (err instanceof UnbalancedTransactionError)
            return 422;
        if (err instanceof InsufficientFundsError)
            return 422;
        if (err instanceof AccountFrozenError)
            return 403;
        if (err instanceof AccountNotFoundError)
            return 404;
        if (err instanceof DuplicateTransactionError)
            return 409;
        if (err.message.includes('Concurrent request'))
            return 409;
        return 500;
    }
}
//# sourceMappingURL=transaction.controller.js.map