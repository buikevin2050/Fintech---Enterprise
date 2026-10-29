import { describe, it, expect } from 'vitest';
import { Currency } from '../../../src/ledger/domain/value-objects/currency.vo.js';
import { Money } from '../../../src/ledger/domain/value-objects/money.vo.js';

describe('Money Value Object', () => {
  const USD = Currency.USD();
  const EUR = Currency.EUR();

  it('should create Money from integer minor units', () => {
    const moneyRes = Money.create(1050n, USD);
    expect(moneyRes.isSuccess).toBe(true);
    expect(moneyRes.getValue().amount).toBe(1050n);
    expect(moneyRes.getValue().currency.code).toBe('USD');
  });

  it('should reject non-integer floating point numbers to avoid IEEE-754 drift', () => {
    const moneyRes = Money.create(10.5, USD);
    expect(moneyRes.isFailure).toBe(true);
    expect(moneyRes.getError().message).toContain('Floating point amounts are prohibited');
  });

  it('should accurately parse decimal strings into minor units', () => {
    const moneyRes = Money.fromDecimal('123.45', USD);
    expect(moneyRes.isSuccess).toBe(true);
    expect(moneyRes.getValue().amount).toBe(12345n);
    expect(moneyRes.getValue().toDecimalString()).toBe('123.45');
  });

  it('should correctly format money with decimals', () => {
    const money = Money.create(500n, USD).getValue();
    expect(money.toDecimalString()).toBe('5.00');

    const centsOnly = Money.create(7n, USD).getValue();
    expect(centsOnly.toDecimalString()).toBe('0.07');
  });

  it('should add money of the same currency', () => {
    const m1 = Money.create(1000n, USD).getValue();
    const m2 = Money.create(2500n, USD).getValue();

    const sumRes = m1.add(m2);
    expect(sumRes.isSuccess).toBe(true);
    expect(sumRes.getValue().amount).toBe(3500n);
  });

  it('should fail when adding money of different currencies', () => {
    const m1 = Money.create(1000n, USD).getValue();
    const m2 = Money.create(1000n, EUR).getValue();

    const sumRes = m1.add(m2);
    expect(sumRes.isFailure).toBe(true);
    expect(sumRes.getError().message).toContain('mismatched currencies');
  });

  it('should subtract money correctly', () => {
    const m1 = Money.create(5000n, USD).getValue();
    const m2 = Money.create(1200n, USD).getValue();

    const diffRes = m1.subtract(m2);
    expect(diffRes.isSuccess).toBe(true);
    expect(diffRes.getValue().amount).toBe(3800n);
  });

  it('should allocate amounts evenly across ratios without losing remainder pennies', () => {
    // Distribute $1.00 (100 cents) across 3 equal buckets (1:1:1)
    // Naive division gives 33.33 cents, losing 1 cent.
    // Largest Remainder Method gives: 34, 33, 33 = 100 cents exactly!
    const m = Money.create(100n, USD).getValue();
    const allocRes = m.allocate([1, 1, 1]);

    expect(allocRes.isSuccess).toBe(true);
    const shares = allocRes.getValue();
    expect(shares.length).toBe(3);

    const total = shares.reduce((acc, s) => acc + s.amount, 0n);
    expect(total).toBe(100n);
    expect(shares[0]?.amount).toBe(34n);
    expect(shares[1]?.amount).toBe(33n);
    expect(shares[2]?.amount).toBe(33n);
  });
});
