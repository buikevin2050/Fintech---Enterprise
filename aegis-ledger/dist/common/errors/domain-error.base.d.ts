/**
 * Base domain exception representing invariant violations in business rules.
 */
export declare abstract class DomainError extends Error {
    abstract readonly code: string;
    constructor(message: string);
}
//# sourceMappingURL=domain-error.base.d.ts.map