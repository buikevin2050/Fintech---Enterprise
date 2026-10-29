import { Entity } from '../../../common/domain/entity.js';
import { Result } from '../../../common/domain/result.js';
import { Money } from '../value-objects/money.vo.js';
import { InvalidEntryError } from '../exceptions/ledger.exceptions.js';

export type EntryDirection = 'DEBIT' | 'CREDIT';

export interface EntryProps {
  transactionId: string;
  accountId: string;
  direction: EntryDirection;
  amount: Money;
  sequence: number;
  description?: string | undefined;
  createdAt: Date;
}

export class Entry extends Entity<EntryProps> {
  private constructor(props: EntryProps, id: string) {
    super(props, id);
  }

  get transactionId(): string {
    return this.props.transactionId;
  }

  get accountId(): string {
    return this.props.accountId;
  }

  get direction(): EntryDirection {
    return this.props.direction;
  }

  get amount(): Money {
    return this.props.amount;
  }

  get sequence(): number {
    return this.props.sequence;
  }

  get description(): string | undefined {
    return this.props.description;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  public static create(
    props: Omit<EntryProps, 'createdAt'> & { createdAt?: Date },
    id: string
  ): Result<Entry, InvalidEntryError> {
    if (!props.transactionId || props.transactionId.trim() === '') {
      return Result.fail(new InvalidEntryError('Transaction ID is required.'));
    }

    if (!props.accountId || props.accountId.trim() === '') {
      return Result.fail(new InvalidEntryError('Account ID is required.'));
    }

    if (props.direction !== 'DEBIT' && props.direction !== 'CREDIT') {
      return Result.fail(new InvalidEntryError('Direction must be either DEBIT or CREDIT.'));
    }

    if (!props.amount.isPositive()) {
      return Result.fail(
        new InvalidEntryError(
          `Entry amount must be strictly positive (> 0). Received: ${props.amount.amount.toString()}`
        )
      );
    }

    if (props.sequence < 0 || !Number.isInteger(props.sequence)) {
      return Result.fail(new InvalidEntryError('Sequence must be a non-negative integer.'));
    }

    const entry = new Entry(
      {
        ...props,
        createdAt: props.createdAt ?? new Date(),
      },
      id
    );

    return Result.ok(entry);
  }
}
