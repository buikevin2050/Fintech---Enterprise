/**
 * Abstract ValueObject base class.
 * Value objects have no conceptual identity; they are defined entirely by their attributes.
 * They are strictly immutable.
 */
export declare abstract class ValueObject<T> {
    protected readonly props: Readonly<T>;
    constructor(props: T);
    equals(vo?: ValueObject<T>): boolean;
}
//# sourceMappingURL=value-object.d.ts.map