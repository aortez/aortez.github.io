class View
{
  constructor() {
    this.scene = new THREE.Scene();
    let aspect_ratio = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera( 100, aspect_ratio, 0.1, 1000 );
    this.camera.position.z = 100;

    this.renderer = new THREE.WebGLRenderer();
    this.renderer.setSize( window.innerWidth, window.innerHeight );
    document.body.appendChild( this.renderer.domElement );
  }

  addObject( object ) {
    this.scene.add( object );
  }

  clear() {
    this.scene = new THREE.Scene();
  }

  render() {
    this.renderer.render( this.scene, this.camera );
  }

}
