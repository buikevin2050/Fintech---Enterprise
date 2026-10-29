/**
 * Functional Result pattern implementation for robust domain and use case error handling.
 * Eliminates unhandled runtime exceptions and makes failures explicit in method signatures.
 */
export class Result {
    isSuccess;
    isFailure;
    _value;
    _error;
    constructor(isSuccess, error, value) {
        this.isSuccess = isSuccess;
        this.isFailure = !isSuccess;
        this._value = value;
        this._error = error;
        Object.freeze(this);
    }
    getValue() {
        if (!this.isSuccess) {
            throw new Error(`Cannot retrieve value from a failed Result. Error: ${JSON.stringify(this._error)}`);
        }
        return this._value;
    }
    getError() {
        if (this.isSuccess) {
            throw new Error('Cannot retrieve error from a successful Result.');
        }
        return this._error;
    }
    static ok(value) {
        return new Result(true, undefined, value);
    }
    static fail(error) {
        return new Result(false, error, undefined);
    }
    static combine(results) {
        for (const result of results) {
            if (result.isFailure) {
                return Result.fail(result.getError());
            }
        }
        return Result.ok();
    }
}
//# sourceMappingURL=result.js.map