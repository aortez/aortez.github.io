"use strict";
class vec3
{
  constructor( x, y, z ) {
    this.x = x;
    this.y = y;
    this.z = z;
    // console.log( "x, y: " + x + ", " + y );
  }

  copy() {
    var c = new vec3( this.x, this.y, this.z );
    return c;
  }

  // distance( b ) {
  //   var dx = this.x - b.x;
  //   var dy = this.y - b.y;
  //   var d = Math.sqrt( dx * dx + dy * dy );
  //   return d;
  // }
  //
  // plus( a ) {
  //   this.x += a.x;
  //   this.y += a.y;
  //   return this;
  // }
  //
  // minus( a ) {
  //   this.x -= a.x;
  //   this.y -= a.y;
  //   return this;
  // }
  //
  times( scalar ) {
    this.x *= scalar;
    this.y *= scalar;
    this.z *= scalar;
    return this;
  }

  toRGB() {
    var rgb = "rgb(" + this.x + "," + this.y + "," + this.z + ")";
    return rgb;
  }
  //
  // mag() {
  //   var m = Math.sqrt( this.x * this.x + this.y * this.y );
  //   return m;
  // }
  //
  // dot( b ) {
  //   var scalarProduct = this.x * b.x + this.y * b.y;
  //   return scalarProduct;
  // }
  //
  // normalize() {
  //   var m = this.mag();
  //   this.x /= m;
  //   this.y /= m;
  //   return this;
  // }

}
