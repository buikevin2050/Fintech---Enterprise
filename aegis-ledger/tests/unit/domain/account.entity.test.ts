import { describe, it, expect } from 'vitest';
import { Currency } from '../../../src/ledger/domain/value-objects/currency.vo.js';
import { Money } from '../../../src/ledger/domain/value-objects/money.vo.js';
import { Entry } from '../../../src/ledger/domain/entities/entry.entity.js';
import { Account } from '../../../src/ledger/domain/entities/account.entity.js';
import { InsufficientFundsError, AccountFrozenError } from '../../../src/ledger/domain/exceptions/ledger.exceptions.js';

describe('Account Entity & Accounting Rules', () => {
  const USD = Currency.USD();

  it('should increase ASSET balance with DEBIT and decrease with CREDIT', () => {
    const cashAccount = Account.create(
      {
        code: '1010',
        name: 'Operating Cash',
        type: 'ASSET',
        currency: USD,
        allowNegativeBalance: false,
        initialBalance: Money.create(10000n, USD).getValue(),
      },
      'acc-cash'
    ).getValue();

    // Debit entry of $50 (increases asset)
    const debitEntry = Entry.create(
      {
        transactionId: 'tx-1',
        accountId: 'acc-cash',
        direction: 'DEBIT',
        amount: Money.create(5000n, USD).getValue(),
        sequence: 0,
      },
      'e-1'
    ).getValue();

    cashAccount.applyEntry(debitEntry);
    expect(cashAccount.balance.amount).toBe(15000n);

    // Credit entry of $30 (decreases asset)
    const creditEntry = Entry.create(
      {
        transactionId: 'tx-2',
        accountId: 'acc-cash',
        direction: 'CREDIT',
        amount: Money.create(3000n, USD).getValue(),
        sequence: 0,
      },
      'e-2'
    ).getValue();

    cashAccount.applyEntry(creditEntry);
    expect(cashAccount.balance.amount).toBe(12000n);
  });

  it('should prevent negative balance if allowNegativeBalance is false', () => {
    const cashAccount = Account.create(
      {
        code: '1010',
        name: 'Operating Cash',
        type: 'ASSET',
        currency: USD,
        allowNegativeBalance: false,
        initialBalance: Money.create(1000n, USD).getValue(),
      },
      'acc-cash'
    ).getValue();

    // Attempt to withdraw $20 when only $10 is available
    const excessiveCredit = Entry.create(
      {
        transactionId: 'tx-overdraft',
        accountId: 'acc-cash',
        direction: 'CREDIT',
        amount: Money.create(2000n, USD).getValue(),
        sequence: 0,
      },
      'e-3'
    ).getValue();

    const applyRes = cashAccount.applyEntry(excessiveCredit);
    expect(applyRes.isFailure).toBe(true);
    expect(applyRes.getError()).toBeInstanceOf(InsufficientFundsError);
    // Balance must remain intact
    expect(cashAccount.balance.amount).toBe(1000n);
  });

  it('should disallow mutations on FROZEN accounts', () => {
    const account = Account.create(
      {
        code: '1010',
        name: 'Frozen Account',
        type: 'ASSET',
        currency: USD,
        status: 'FROZEN',
      },
      'acc-frozen'
    ).getValue();

    const entry = Entry.create(
      {
        transactionId: 'tx-freeze',
        accountId: 'acc-frozen',
        direction: 'DEBIT',
        amount: Money.create(500n, USD).getValue(),
        sequence: 0,
      },
      'e-4'
    ).getValue();

    const res = account.applyEntry(entry);
    expect(res.isFailure).toBe(true);
    expect(res.getError()).toBeInstanceOf(AccountFrozenError);
  });
});
