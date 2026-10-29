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
export abstract class AggregateRoot<T> extends Entity<T> {
  private _domainEvents: IDomainEvent[] = [];

  get domainEvents(): ReadonlyArray<IDomainEvent> {
    return this._domainEvents;
  }

  protected addDomainEvent(domainEvent: IDomainEvent): void {
    this._domainEvents.push(domainEvent);
  }

  public clearEvents(): void {
    this._domainEvents = [];
  }
}
