/**
 * Abstract Entity base class.
 * Entities have an identity (ID) that persists over time and states.
 */
export class Entity {
    _id;
    props;
    constructor(props, id) {
        this._id = id;
        this.props = props;
    }
    get id() {
        return this._id;
    }
    equals(object) {
        if (object === null || object === undefined) {
            return false;
        }
        if (this === object) {
            return true;
        }
        if (!(object instanceof Entity)) {
            return false;
        }
        return this._id === object._id;
    }
}
//# sourceMappingURL=entity.js.map