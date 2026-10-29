/**
 * Abstract ValueObject base class.
 * Value objects have no conceptual identity; they are defined entirely by their attributes.
 * They are strictly immutable.
 */
export class ValueObject {
    props;
    constructor(props) {
        this.props = Object.freeze({ ...props });
    }
    equals(vo) {
        if (vo === null || vo === undefined) {
            return false;
        }
        if (vo.props === undefined) {
            return false;
        }
        return JSON.stringify(this.props) === JSON.stringify(vo.props);
    }
}
//# sourceMappingURL=value-object.js.map