import { ValueObject } from '../../../common/domain/value-object.js';
import { Result } from '../../../common/domain/result.js';
const SUPPORTED_CURRENCIES = {
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
export class Currency extends ValueObject {
    constructor(props) {
        super(props);
    }
    get code() {
        return this.props.code;
    }
    get decimals() {
        return this.props.decimals;
    }
    static create(code, decimals) {
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
    static USD() {
        return new Currency({ code: 'USD', decimals: 2 });
    }
    static EUR() {
        return new Currency({ code: 'EUR', decimals: 2 });
    }
    static JPY() {
        return new Currency({ code: 'JPY', decimals: 0 });
    }
    static GBP() {
        return new Currency({ code: 'GBP', decimals: 2 });
    }
}
//# sourceMappingURL=currency.vo.js.map