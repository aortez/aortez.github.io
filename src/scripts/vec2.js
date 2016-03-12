class vec2
{
  constructor( x, y ) {
    this.x = x;
    this.y = y;
    // console.log( "x, y: " + x + ", " + y );
  }

  copy() {
    var c = new vec2( this.x, this.y );
    return c;
  }

  distance( b ) {
    var dx = this.x - b.x;
    var dy = this.y - b.y;
    var d = Math.sqrt( dx * dx + dy * dy );
    return d;
  }

  plus( a ) {
    this.x += a.x;
    this.y += a.y;
    return this;
  }

  minus( a ) {
    this.x -= a.x;
    this.y -= a.y;
    return this;
  }

  times( scalar ) {
    this.x *= scalar;
    this.y *= scalar;
    return this;
  }

  mag() {
    var m = Math.sqrt( this.x * this.x + this.y * this.y );
    return m;
  }

  dot( b ) {
    var scalarProduct = this.x * b.x + this.y * b.y;
    return scalarProduct;
  }

  normalize() {
    var m = this.mag();
    this.x /= m;
    this.y /= m;
    return this;
  }

}
