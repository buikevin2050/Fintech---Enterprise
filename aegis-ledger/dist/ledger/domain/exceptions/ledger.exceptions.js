import { DomainError } from '../../../common/errors/domain-error.base.js';
export class UnbalancedTransactionError extends DomainError {
    code = 'UNBALANCED_TRANSACTION';
    constructor(totalDebit, totalCredit, currency) {
        super(`Double-entry invariant violated: Total Debits (${totalDebit}) must equal Total Credits (${totalCredit}) for currency ${currency}. Net imbalance: ${totalDebit - totalCredit}`);
    }
}
export class InsufficientFundsError extends DomainError {
    code = 'INSUFFICIENT_FUNDS';
    constructor(accountId, currentBalance, attemptedDebit) {
        super(`Account ${accountId} has insufficient funds. Current balance: ${currentBalance}, attempted debit: ${attemptedDebit}`);
    }
}
export class AccountFrozenError extends DomainError {
    code = 'ACCOUNT_FROZEN';
    constructor(accountId) {
        super(`Account ${accountId} is frozen or closed. Financial mutations are prohibited.`);
    }
}
export class AccountNotFoundError extends DomainError {
    code = 'ACCOUNT_NOT_FOUND';
    constructor(accountId) {
        super(`Account not found with ID: ${accountId}`);
    }
}
export class DuplicateTransactionError extends DomainError {
    code = 'DUPLICATE_TRANSACTION_IDEMPOTENCY';
    constructor(idempotencyKey) {
        super(`Transaction with idempotency key "${idempotencyKey}" has already been processed.`);
    }
}
export class InvalidEntryError extends DomainError {
    code = 'INVALID_ENTRY';
    constructor(message) {
        super(`Invalid ledger entry: ${message}`);
    }
}
export class TransactionAlreadyPostedError extends DomainError {
    code = 'TRANSACTION_ALREADY_POSTED';
    constructor(transactionId) {
        super(`Transaction ${transactionId} has already been posted and is sealed/immutable.`);
    }
}
export class CurrencyMismatchError extends DomainError {
    code = 'CURRENCY_MISMATCH';
    constructor(expected, received) {
        super(`Currency mismatch: expected ${expected}, but received ${received}. Multi-currency entries must balance per currency.`);
    }
}
//# sourceMappingURL=ledger.exceptions.js.map