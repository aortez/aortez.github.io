export class Vec2 {
  x: number;
  y: number;

  constructor( x, y ) {
    this.x = x;
    this.y = y;
  }

  copy() {
    const c = new Vec2( this.x, this.y );
    return c;
  }
  //
  // distance( b ) {
  //   let dx = this.x - b.x;
  //   let dy = this.y - b.y;
  //   let d = Math.sqrt( dx * dx + dy * dy );
  //   return d;
  // }
  //
  public plus( a ) {
    this.x += a.x;
    this.y += a.y;
    return this;
  }
  //
  // minus( a ) {
  //   this.x -= a.x;
  //   this.y -= a.y;
  //   return this;
  // }

  public times( scalar: number ) {
    this.x *= scalar;
    this.y *= scalar;
    return this;
  }

  public div( scalar: number ) {
    this.x /= scalar;
    this.y /= scalar;
    return this;
  }
  //
  // mag() {
  //   let m = Math.sqrt( this.x * this.x + this.y * this.y );
  //   return m;
  // }
  //
  // dot( b ) {
  //   let scalarProduct = this.x * b.x + this.y * b.y;
  //   return scalarProduct;
  // }
  //
  // normalize() {
  //   let m = this.mag();
  //   this.x /= m;
  //   this.y /= m;
  //   return this;
  // }
  //
  // toString() {
  //   return "(" + this.x + ", " + this.y + ")";
  // }
  //
  // toStringVerbose() {
  //   return "vec2 x: " + this.x + ", y: " + this.y;
  // }

}
