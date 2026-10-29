import { DomainError } from '../../../common/errors/domain-error.base.js';
export declare class UnbalancedTransactionError extends DomainError {
    readonly code = "UNBALANCED_TRANSACTION";
    constructor(totalDebit: bigint, totalCredit: bigint, currency: string);
}
export declare class InsufficientFundsError extends DomainError {
    readonly code = "INSUFFICIENT_FUNDS";
    constructor(accountId: string, currentBalance: bigint, attemptedDebit: bigint);
}
export declare class AccountFrozenError extends DomainError {
    readonly code = "ACCOUNT_FROZEN";
    constructor(accountId: string);
}
export declare class AccountNotFoundError extends DomainError {
    readonly code = "ACCOUNT_NOT_FOUND";
    constructor(accountId: string);
}
export declare class DuplicateTransactionError extends DomainError {
    readonly code = "DUPLICATE_TRANSACTION_IDEMPOTENCY";
    constructor(idempotencyKey: string);
}
export declare class InvalidEntryError extends DomainError {
    readonly code = "INVALID_ENTRY";
    constructor(message: string);
}
export declare class TransactionAlreadyPostedError extends DomainError {
    readonly code = "TRANSACTION_ALREADY_POSTED";
    constructor(transactionId: string);
}
export declare class CurrencyMismatchError extends DomainError {
    readonly code = "CURRENCY_MISMATCH";
    constructor(expected: string, received: string);
}
//# sourceMappingURL=ledger.exceptions.d.ts.map