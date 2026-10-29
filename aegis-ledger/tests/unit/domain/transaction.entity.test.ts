import { describe, it, expect } from 'vitest';
import { Currency } from '../../../src/ledger/domain/value-objects/currency.vo.js';
import { Money } from '../../../src/ledger/domain/value-objects/money.vo.js';
import { Entry } from '../../../src/ledger/domain/entities/entry.entity.js';
import { Transaction } from '../../../src/ledger/domain/entities/transaction.entity.js';
import { UnbalancedTransactionError } from '../../../src/ledger/domain/exceptions/ledger.exceptions.js';

describe('Transaction Aggregate Root & Double-Entry Invariants', () => {
  const USD = Currency.USD();

  it('should successfully create a balanced double-entry transaction', () => {
    const debitEntry = Entry.create(
      {
        transactionId: 'tx-1',
        accountId: 'acc-cash',
        direction: 'DEBIT',
        amount: Money.create(5000n, USD).getValue(),
        sequence: 0,
      },
      'entry-1'
    ).getValue();

    const creditEntry = Entry.create(
      {
        transactionId: 'tx-1',
        accountId: 'acc-revenue',
        direction: 'CREDIT',
        amount: Money.create(5000n, USD).getValue(),
        sequence: 1,
      },
      'entry-2'
    ).getValue();

    const txRes = Transaction.create(
      {
        idempotencyKey: 'idemp-1',
        description: 'Customer payment received',
        entries: [debitEntry, creditEntry],
      },
      'tx-1'
    );

    expect(txRes.isSuccess).toBe(true);
    const tx = txRes.getValue();
    expect(tx.status).toBe('DRAFT');
    expect(tx.entries.length).toBe(2);

    const postRes = tx.post();
    expect(postRes.isSuccess).toBe(true);
    expect(tx.status).toBe('POSTED');
    expect(tx.postedAt).toBeInstanceOf(Date);
    expect(tx.domainEvents.length).toBe(1);
  });

  it('should enforce double-entry invariant: fail when Debits do not equal Credits', () => {
    const debitEntry = Entry.create(
      {
        transactionId: 'tx-2',
        accountId: 'acc-cash',
        direction: 'DEBIT',
        amount: Money.create(5000n, USD).getValue(),
        sequence: 0,
      },
      'entry-1'
    ).getValue();

    const creditEntry = Entry.create(
      {
        transactionId: 'tx-2',
        accountId: 'acc-revenue',
        direction: 'CREDIT',
        amount: Money.create(4000n, USD).getValue(), // Imbalance of 1000
        sequence: 1,
      },
      'entry-2'
    ).getValue();

    const txRes = Transaction.create(
      {
        idempotencyKey: 'idemp-unbalanced',
        description: 'Faulty unbalanced entry',
        entries: [debitEntry, creditEntry],
      },
      'tx-2'
    );

    expect(txRes.isFailure).toBe(true);
    const err = txRes.getError();
    expect(err).toBeInstanceOf(UnbalancedTransactionError);
    expect(err.message).toContain('Double-entry invariant violated');
  });

  it('should reject transactions with fewer than 2 entries', () => {
    const singleEntry = Entry.create(
      {
        transactionId: 'tx-3',
        accountId: 'acc-cash',
        direction: 'DEBIT',
        amount: Money.create(1000n, USD).getValue(),
        sequence: 0,
      },
      'entry-1'
    ).getValue();

    const txRes = Transaction.create(
      {
        idempotencyKey: 'idemp-single',
        description: 'Single leg attempt',
        entries: [singleEntry],
      },
      'tx-3'
    );

    expect(txRes.isFailure).toBe(true);
    expect(txRes.getError().message).toContain('at least 2 entries');
  });

  it('should create an append-only mirror reversal transaction', () => {
    const debit = Entry.create(
      {
        transactionId: 'tx-orig',
        accountId: 'acc-cash',
        direction: 'DEBIT',
        amount: Money.create(7500n, USD).getValue(),
        sequence: 0,
      },
      'e-1'
    ).getValue();

    const credit = Entry.create(
      {
        transactionId: 'tx-orig',
        accountId: 'acc-ap',
        direction: 'CREDIT',
        amount: Money.create(7500n, USD).getValue(),
        sequence: 1,
      },
      'e-2'
    ).getValue();

    const origTx = Transaction.create(
      {
        idempotencyKey: 'idemp-orig',
        description: 'Original payment',
        entries: [debit, credit],
      },
      'tx-orig'
    ).getValue();

    origTx.post();

    // Create reversal
    const revRes = origTx.createReversal('tx-rev-1', 'idemp-rev-1', 'Void accidental payment');
    expect(revRes.isSuccess).toBe(true);

    const revTx = revRes.getValue();
    expect(revTx.type).toBe('REVERSAL');
    expect(revTx.reversesTransactionId).toBe('tx-orig');
    expect(revTx.entries.length).toBe(2);

    // Direction must be inverted!
    const revEntry0 = revTx.entries[0]!;
    const revEntry1 = revTx.entries[1]!;
    expect(revEntry0.accountId).toBe('acc-cash');
    expect(revEntry0.direction).toBe('CREDIT'); // Was DEBIT

    expect(revEntry1.accountId).toBe('acc-ap');
    expect(revEntry1.direction).toBe('DEBIT'); // Was CREDIT

    expect(origTx.status).toBe('REVERSED');
  });
});
