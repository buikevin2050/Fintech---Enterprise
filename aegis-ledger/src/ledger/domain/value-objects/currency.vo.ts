import { ValueObject } from '../../../common/domain/value-object.js';
import { Result } from '../../../common/domain/result.js';

interface CurrencyProps {
  code: string;
  decimals: number;
}

const SUPPORTED_CURRENCIES: Record<string, number> = {
  USD: 2,
  EUR: 2,
  GBP: 2,
  JPY: 0,
  CHF: 2,
  CAD: 2,
  AUD: 2,
  SGD: 2,
  HKD: 2,
  NZD: 2,
  BRL: 2,
  INR: 2,
  BHD: 3,
  KWD: 3,
  USDC: 6,
  BTC: 8,
};

export class Currency extends ValueObject<CurrencyProps> {
  private constructor(props: CurrencyProps) {
    super(props);
  }

  get code(): string {
    return this.props.code;
  }

  get decimals(): number {
    return this.props.decimals;
  }

  public static create(code: string, decimals?: number): Result<Currency> {
    const normalizedCode = code.trim().toUpperCase();
    if (!/^[A-Z]{3,5}$/.test(normalizedCode)) {
      return Result.fail(new Error(`Invalid currency code format: "${code}". Must be 3-5 uppercase letters.`));
    }

    const defaultDecimals = SUPPORTED_CURRENCIES[normalizedCode] ?? 2;
    const finalDecimals = decimals !== undefined ? decimals : defaultDecimals;

    if (finalDecimals < 0 || finalDecimals > 18) {
      return Result.fail(new Error(`Invalid currency decimals: ${finalDecimals}. Must be between 0 and 18.`));
    }

    return Result.ok(new Currency({ code: normalizedCode, decimals: finalDecimals }));
  }

  public static USD(): Currency {
    return new Currency({ code: 'USD', decimals: 2 });
  }

  public static EUR(): Currency {
    return new Currency({ code: 'EUR', decimals: 2 });
  }

  public static JPY(): Currency {
    return new Currency({ code: 'JPY', decimals: 0 });
  }

  public static GBP(): Currency {
    return new Currency({ code: 'GBP', decimals: 2 });
  }
}
