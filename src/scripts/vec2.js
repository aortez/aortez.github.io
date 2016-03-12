class vec2
{
  constructor( x, y ) {
    this.x = x;
    this.y = y;
    console.log( "x, y: " + x + ", " + y );
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
    this.x = this.x + a.x;
    this.y = this.y + a.y;
    return this;
  }

  minus( a ) {
    this.x -= a.x;
    this.y -= a.y;
    return this;
  }

  times( scalar ) {
    this.x = this.x * scalar;
    this.y = this.y * scalar;
    return this;
  }

  mag() {
    var m = Math.sqrt( this.x * this.x + this.y * this.y );
    return m;
  }

  dot( a, b ) {
    var scalarProduct = a.x * b.x + a.y * b.y;
    return scalarProduct;
  }

  normalize() {
    var m = this.mag();
    this.x = this.x / m;
    this.y = this.y / m;
    return this;
  }

}
