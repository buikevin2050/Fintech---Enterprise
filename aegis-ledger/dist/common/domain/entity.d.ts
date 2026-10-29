/**
 * Abstract Entity base class.
 * Entities have an identity (ID) that persists over time and states.
 */
export declare abstract class Entity<T> {
    protected readonly _id: string;
    protected readonly props: T;
    constructor(props: T, id: string);
    get id(): string;
    equals(object?: Entity<T>): boolean;
}
//# sourceMappingURL=entity.d.ts.map