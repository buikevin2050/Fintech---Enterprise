import { AggregateRoot, IDomainEvent } from '../../../common/domain/aggregate-root.js';
import { Result } from '../../../common/domain/result.js';
import { Entry, EntryDirection } from './entry.entity.js';
import {
  UnbalancedTransactionError,
  TransactionAlreadyPostedError,
  InvalidEntryError,
} from '../exceptions/ledger.exceptions.js';

export type TransactionStatus = 'DRAFT' | 'POSTED' | 'REVERSED';
export type TransactionType = 'STANDARD' | 'REVERSAL';

export interface TransactionProps {
  idempotencyKey: string;
  type: TransactionType;
  status: TransactionStatus;
  description: string;
  reversesTransactionId?: string | undefined;
  entries: Entry[];
  postedAt?: Date | undefined;
  createdAt: Date;
}

export class TransactionPostedEvent implements IDomainEvent {
  public readonly eventName = 'TransactionPostedEvent';
  public readonly dateTimeOccurred: Date;
  constructor(
    public readonly aggregateId: string,
    public readonly idempotencyKey: string,
    public readonly entriesCount: number,
    public readonly type: TransactionType
  ) {
    this.dateTimeOccurred = new Date();
  }
}

export class TransactionReversedEvent implements IDomainEvent {
  public readonly eventName = 'TransactionReversedEvent';
  public readonly dateTimeOccurred: Date;
  constructor(
    public readonly aggregateId: string,
    public readonly originalTransactionId: string,
    public readonly reversalTransactionId: string
  ) {
    this.dateTimeOccurred = new Date();
  }
}

export class Transaction extends AggregateRoot<TransactionProps> {
  private constructor(props: TransactionProps, id: string) {
    super(props, id);
  }

  get idempotencyKey(): string {
    return this.props.idempotencyKey;
  }

  get type(): TransactionType {
    return this.props.type;
  }

  get status(): TransactionStatus {
    return this.props.status;
  }

  get description(): string {
    return this.props.description;
  }

  get reversesTransactionId(): string | undefined {
    return this.props.reversesTransactionId;
  }

  get entries(): ReadonlyArray<Entry> {
    return [...this.props.entries];
  }

  get postedAt(): Date | undefined {
    return this.props.postedAt;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  /**
   * Factory method to construct and validate a new Transaction aggregate.
   */
  public static create(
    props: {
      idempotencyKey: string;
      description: string;
      type?: TransactionType;
      reversesTransactionId?: string | undefined;
      entries: Entry[];
      status?: TransactionStatus;
      postedAt?: Date | undefined;
      createdAt?: Date;
    },
    id: string
  ): Result<Transaction, UnbalancedTransactionError | InvalidEntryError | Error> {
    if (!props.idempotencyKey || props.idempotencyKey.trim().length === 0) {
      return Result.fail(new Error('Idempotency key is required for all transactions.'));
    }

    if (!props.description || props.description.trim().length === 0) {
      return Result.fail(new Error('Transaction description is required for audit trail.'));
    }

    if (!props.entries || props.entries.length < 2) {
      return Result.fail(
        new InvalidEntryError('A double-entry transaction must contain at least 2 entries.')
      );
    }

    // Verify double-entry balance invariant per currency: Sum(DEBITS) === Sum(CREDITS)
    const currencyDebitTotals = new Map<string, bigint>();
    const currencyCreditTotals = new Map<string, bigint>();

    for (const entry of props.entries) {
      const currCode = entry.amount.currency.code;
      const currentDebit = currencyDebitTotals.get(currCode) ?? 0n;
      const currentCredit = currencyCreditTotals.get(currCode) ?? 0n;

      if (entry.direction === 'DEBIT') {
        currencyDebitTotals.set(currCode, currentDebit + entry.amount.amount);
      } else {
        currencyCreditTotals.set(currCode, currentCredit + entry.amount.amount);
      }
    }

    const allCurrencies = new Set([...currencyDebitTotals.keys(), ...currencyCreditTotals.keys()]);
    for (const currCode of allCurrencies) {
      const debitTotal = currencyDebitTotals.get(currCode) ?? 0n;
      const creditTotal = currencyCreditTotals.get(currCode) ?? 0n;

      if (debitTotal !== creditTotal) {
        return Result.fail(new UnbalancedTransactionError(debitTotal, creditTotal, currCode));
      }
    }

    const transaction = new Transaction(
      {
        idempotencyKey: props.idempotencyKey.trim(),
        description: props.description.trim(),
        type: props.type ?? 'STANDARD',
        reversesTransactionId: props.reversesTransactionId,
        entries: props.entries,
        status: props.status ?? 'DRAFT',
        postedAt: props.postedAt,
        createdAt: props.createdAt ?? new Date(),
      },
      id
    );

    return Result.ok(transaction);
  }

  /**
   * Finalizes and posts the transaction. Once posted, it becomes completely immutable.
   */
  public post(): Result<void, TransactionAlreadyPostedError> {
    if (this.props.status === 'POSTED') {
      return Result.fail(new TransactionAlreadyPostedError(this.id));
    }

    this.props.status = 'POSTED';
    this.props.postedAt = new Date();

    this.addDomainEvent(
      new TransactionPostedEvent(
        this.id,
        this.idempotencyKey,
        this.props.entries.length,
        this.type
      )
    );

    return Result.ok();
  }

  /**
   * Generates a mirror reversal transaction adhering to append-only ledger rules.
   * Swaps DEBIT and CREDIT on every entry and links back to this transaction ID.
   */
  public createReversal(
    reversalId: string,
    newIdempotencyKey: string,
    reversalDescription?: string
  ): Result<Transaction, Error> {
    if (this.props.status !== 'POSTED') {
      return Result.fail(new Error(`Cannot reverse transaction ${this.id} that is not POSTED.`));
    }

    const reversedEntries: Entry[] = [];

    for (let i = 0; i < this.props.entries.length; i++) {
      const orig = this.props.entries[i]!;
      const invertedDirection: EntryDirection = orig.direction === 'DEBIT' ? 'CREDIT' : 'DEBIT';

      const entryResult = Entry.create(
        {
          transactionId: reversalId,
          accountId: orig.accountId,
          direction: invertedDirection,
          amount: orig.amount,
          sequence: i,
          description: `Reversal of entry ${orig.id} from tx ${this.id}`,
        },
        `rev-entry-${reversalId}-${i}`
      );

      if (entryResult.isFailure) {
        return Result.fail(entryResult.getError());
      }

      reversedEntries.push(entryResult.getValue());
    }

    const reversalTxResult = Transaction.create(
      {
        idempotencyKey: newIdempotencyKey,
        description: reversalDescription ?? `Reversal of transaction ${this.id}`,
        type: 'REVERSAL',
        reversesTransactionId: this.id,
        entries: reversedEntries,
        status: 'DRAFT',
      },
      reversalId
    );

    if (reversalTxResult.isFailure) {
      return Result.fail(reversalTxResult.getError());
    }

    // Mark current transaction as reversed
    this.props.status = 'REVERSED';
    this.addDomainEvent(new TransactionReversedEvent(this.id, this.id, reversalId));

    return Result.ok(reversalTxResult.getValue());
  }
}
