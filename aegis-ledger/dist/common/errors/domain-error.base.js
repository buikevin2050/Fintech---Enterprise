/**
 * Base domain exception representing invariant violations in business rules.
 */
export class DomainError extends Error {
    constructor(message) {
        super(message);
        this.name = this.constructor.name;
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
//# sourceMappingURL=domain-error.base.js.map