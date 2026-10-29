/**
 * Abstract ValueObject base class.
 * Value objects have no conceptual identity; they are defined entirely by their attributes.
 * They are strictly immutable.
 */
export abstract class ValueObject<T> {
  protected readonly props: Readonly<T>;

  constructor(props: T) {
    this.props = Object.freeze({ ...props });
  }

  public equals(vo?: ValueObject<T>): boolean {
    if (vo === null || vo === undefined) {
      return false;
    }
    if (vo.props === undefined) {
      return false;
    }
    return JSON.stringify(this.props) === JSON.stringify(vo.props);
  }
}
