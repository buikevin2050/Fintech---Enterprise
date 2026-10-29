import { Entity } from './entity.js';
export interface IDomainEvent {
    dateTimeOccurred: Date;
    aggregateId: string;
    eventName: string;
}
/**
 * AggregateRoot base class.
 * Enforces transactional consistency boundary around a cluster of entities.
 */
export declare abstract class AggregateRoot<T> extends Entity<T> {
    private _domainEvents;
    get domainEvents(): ReadonlyArray<IDomainEvent>;
    protected addDomainEvent(domainEvent: IDomainEvent): void;
    clearEvents(): void;
}
//# sourceMappingURL=aggregate-root.d.ts.map