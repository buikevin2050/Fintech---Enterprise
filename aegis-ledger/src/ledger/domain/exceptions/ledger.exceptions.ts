import { DomainError } from '../../../common/errors/domain-error.base.js';

export class UnbalancedTransactionError extends DomainError {
  public readonly code = 'UNBALANCED_TRANSACTION';
  constructor(totalDebit: bigint, totalCredit: bigint, currency: string) {
    super(
      `Double-entry invariant violated: Total Debits (${totalDebit}) must equal Total Credits (${totalCredit}) for currency ${currency}. Net imbalance: ${totalDebit - totalCredit}`
    );
  }
}

export class InsufficientFundsError extends DomainError {
  public readonly code = 'INSUFFICIENT_FUNDS';
  constructor(accountId: string, currentBalance: bigint, attemptedDebit: bigint) {
    super(
      `Account ${accountId} has insufficient funds. Current balance: ${currentBalance}, attempted debit: ${attemptedDebit}`
    );
  }
}

export class AccountFrozenError extends DomainError {
  public readonly code = 'ACCOUNT_FROZEN';
  constructor(accountId: string) {
    super(`Account ${accountId} is frozen or closed. Financial mutations are prohibited.`);
  }
}

export class AccountNotFoundError extends DomainError {
  public readonly code = 'ACCOUNT_NOT_FOUND';
  constructor(accountId: string) {
    super(`Account not found with ID: ${accountId}`);
  }
}

export class DuplicateTransactionError extends DomainError {
  public readonly code = 'DUPLICATE_TRANSACTION_IDEMPOTENCY';
  constructor(idempotencyKey: string) {
    super(`Transaction with idempotency key "${idempotencyKey}" has already been processed.`);
  }
}

export class InvalidEntryError extends DomainError {
  public readonly code = 'INVALID_ENTRY';
  constructor(message: string) {
    super(`Invalid ledger entry: ${message}`);
  }
}

export class TransactionAlreadyPostedError extends DomainError {
  public readonly code = 'TRANSACTION_ALREADY_POSTED';
  constructor(transactionId: string) {
    super(`Transaction ${transactionId} has already been posted and is sealed/immutable.`);
  }
}

export class CurrencyMismatchError extends DomainError {
  public readonly code = 'CURRENCY_MISMATCH';
  constructor(expected: string, received: string) {
    super(`Currency mismatch: expected ${expected}, but received ${received}. Multi-currency entries must balance per currency.`);
  }
}
