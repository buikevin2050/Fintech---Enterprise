import { Entity } from './entity.js';
/**
 * AggregateRoot base class.
 * Enforces transactional consistency boundary around a cluster of entities.
 */
export class AggregateRoot extends Entity {
    _domainEvents = [];
    get domainEvents() {
        return this._domainEvents;
    }
    addDomainEvent(domainEvent) {
        this._domainEvents.push(domainEvent);
    }
    clearEvents() {
        this._domainEvents = [];
    }
}
//# sourceMappingURL=aggregate-root.js.map