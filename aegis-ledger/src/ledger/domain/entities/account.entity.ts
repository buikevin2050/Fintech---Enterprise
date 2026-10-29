import { Entity } from '../../../common/domain/entity.js';
import { Result } from '../../../common/domain/result.js';
import { Money } from '../value-objects/money.vo.js';
import { Currency } from '../value-objects/currency.vo.js';
import { AccountFrozenError, InsufficientFundsError } from '../exceptions/ledger.exceptions.js';
import { Entry } from './entry.entity.js';

export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
export type AccountStatus = 'ACTIVE' | 'FROZEN' | 'CLOSED';

export interface AccountProps {
  code: string;
  name: string;
  type: AccountType;
  currency: Currency;
  balance: Money;
  status: AccountStatus;
  allowNegativeBalance: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export class Account extends Entity<AccountProps> {
  private constructor(props: AccountProps, id: string) {
    super(props, id);
  }

  get code(): string {
    return this.props.code;
  }

  get name(): string {
    return this.props.name;
  }

  get type(): AccountType {
    return this.props.type;
  }

  get currency(): Currency {
    return this.props.currency;
  }

  get balance(): Money {
    return this.props.balance;
  }

  get status(): AccountStatus {
    return this.props.status;
  }

  get allowNegativeBalance(): boolean {
    return this.props.allowNegativeBalance;
  }

  get version(): number {
    return this.props.version;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  public isNormalDebit(): boolean {
    return this.type === 'ASSET' || this.type === 'EXPENSE';
  }

  public isNormalCredit(): boolean {
    return this.type === 'LIABILITY' || this.type === 'EQUITY' || this.type === 'REVENUE';
  }

  public applyEntry(entry: Entry): Result<Account, AccountFrozenError | InsufficientFundsError | Error> {
    if (this.status !== 'ACTIVE') {
      return Result.fail(new AccountFrozenError(this.id));
    }

    if (!this.currency.equals(entry.amount.currency)) {
      return Result.fail(
        new Error(
          `Currency mismatch: Account ${this.id} is ${this.currency.code}, entry amount is ${entry.amount.currency.code}`
        )
      );
    }

    let deltaAmount: bigint;
    if (this.isNormalDebit()) {
      // For ASSET and EXPENSE: Debit increases, Credit decreases
      deltaAmount = entry.direction === 'DEBIT' ? entry.amount.amount : -entry.amount.amount;
    } else {
      // For LIABILITY, EQUITY, REVENUE: Credit increases, Debit decreases
      deltaAmount = entry.direction === 'CREDIT' ? entry.amount.amount : -entry.amount.amount;
    }

    const newAmount = this.balance.amount + deltaAmount;

    // Disallow negative balance if configured (e.g. cash account cannot be overdrawn)
    if (!this.allowNegativeBalance && newAmount < 0n) {
      return Result.fail(
        new InsufficientFundsError(this.id, this.balance.amount, entry.amount.amount)
      );
    }

    const newBalanceResult = Money.create(newAmount, this.currency);
    if (newBalanceResult.isFailure) {
      return Result.fail(newBalanceResult.getError());
    }

    this.props.balance = newBalanceResult.getValue();
    this.props.version += 1;
    this.props.updatedAt = new Date();

    return Result.ok(this);
  }

  public freeze(): void {
    this.props.status = 'FROZEN';
    this.props.updatedAt = new Date();
  }

  public unfreeze(): void {
    this.props.status = 'ACTIVE';
    this.props.updatedAt = new Date();
  }

  public static create(
    props: {
      code: string;
      name: string;
      type: AccountType;
      currency: Currency;
      allowNegativeBalance?: boolean;
      status?: AccountStatus;
      initialBalance?: Money;
      version?: number;
      createdAt?: Date;
      updatedAt?: Date;
    },
    id: string
  ): Result<Account> {
    if (!props.code || props.code.trim().length === 0) {
      return Result.fail(new Error('Account code is required.'));
    }

    if (!props.name || props.name.trim().length === 0) {
      return Result.fail(new Error('Account name is required.'));
    }

    const balance = props.initialBalance ?? Money.zero(props.currency);

    const account = new Account(
      {
        code: props.code.trim().toUpperCase(),
        name: props.name.trim(),
        type: props.type,
        currency: props.currency,
        balance,
        status: props.status ?? 'ACTIVE',
        allowNegativeBalance: props.allowNegativeBalance ?? false,
        version: props.version ?? 0,
        createdAt: props.createdAt ?? new Date(),
        updatedAt: props.updatedAt ?? new Date(),
      },
      id
    );

    return Result.ok(account);
  }
}
