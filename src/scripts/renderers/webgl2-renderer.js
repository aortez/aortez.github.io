import { debug_on } from '../quadtree.js';
import {
  PARTICLE_PIXEL_RADIUS,
} from '../world.js';

const INITIAL_INSTANCE_CAPACITY = 1024;
const INITIAL_OVERLAY_VERTEX_CAPACITY = 1024;
const PIZZA_IMAGE_URL = new URL(
  '../../../pizza.png',
  import.meta.url,
).href;

const CIRCLE_VERTEX_SHADER_SOURCE = `#version 300 es
precision highp float;

layout(location = 0) in vec2 a_corner;
layout(location = 1) in vec3 a_circle;
layout(location = 2) in vec4 a_color;
layout(location = 3) in float a_outline;

uniform vec2 u_canvas_size;
uniform float u_scale;

out vec2 v_local;
out vec4 v_color;
out float v_outline;
out float v_radius_pixels;

void main() {
  float radius_pixels = a_circle.z * u_scale;
  vec2 center_pixels = a_circle.xy * u_scale;
  vec2 position_pixels = center_pixels + a_corner * radius_pixels;
  vec2 clip_position = vec2(
    position_pixels.x / u_canvas_size.x * 2.0 - 1.0,
    1.0 - position_pixels.y / u_canvas_size.y * 2.0
  );

  gl_Position = vec4(clip_position, 0.0, 1.0);
  v_local = a_corner;
  v_color = a_color;
  v_outline = a_outline;
  v_radius_pixels = radius_pixels;
}
`;

const CIRCLE_FRAGMENT_SHADER_SOURCE = `#version 300 es
precision highp float;

in vec2 v_local;
in vec4 v_color;
in float v_outline;
in float v_radius_pixels;

uniform vec2 u_canvas_size;
uniform sampler2D u_pizza_texture;
uniform vec2 u_pizza_texture_size;
uniform bool u_use_pizza_texture;

out vec4 out_color;

void main() {
  float distance_from_center = length(v_local);
  float antialias_width = max(fwidth(distance_from_center), 0.001);
  float coverage = 1.0 - smoothstep(
    1.0 - antialias_width,
    1.0 + antialias_width,
    distance_from_center
  );
  if (coverage <= 0.0) {
    discard;
  }

  vec3 color = v_color.rgb;
  if (u_use_pizza_texture) {
    vec2 canvas_position = vec2(
      gl_FragCoord.x,
      u_canvas_size.y - gl_FragCoord.y
    );
    color = texture(
      u_pizza_texture,
      canvas_position / u_pizza_texture_size
    ).rgb;
  }

  if (v_outline > 0.5) {
    float outline_width = min(
      0.45,
      1.0 / max(v_radius_pixels, 1.0)
    );
    float outline_start = 1.0 - outline_width;
    float outline_mix = smoothstep(
      outline_start - antialias_width,
      outline_start + antialias_width,
      distance_from_center
    );
    color = mix(color, vec3(0.0), outline_mix);
  }

  out_color = vec4(color, v_color.a * coverage);
}
`;

const BACKGROUND_VERTEX_SHADER_SOURCE = `#version 300 es
precision highp float;

const vec2 POSITIONS[3] = vec2[](
  vec2(-1.0, -1.0),
  vec2(3.0, -1.0),
  vec2(-1.0, 3.0)
);

void main() {
  gl_Position = vec4(POSITIONS[gl_VertexID], 0.0, 1.0);
}
`;

const BACKGROUND_FRAGMENT_SHADER_SOURCE = `#version 300 es
precision highp float;

uniform vec2 u_canvas_size;
uniform float u_counter;
uniform float u_counter_max;

out vec4 out_color;

void main() {
  const float column_count = 20.0;
  float cell_size_pixels = u_canvas_size.x / column_count;
  float canvas_y = u_canvas_size.y - gl_FragCoord.y;
  float cell_x = floor(gl_FragCoord.x / cell_size_pixels);
  float cell_y = floor(canvas_y / cell_size_pixels);

  float base_green = 255.0 * pow(
    max(
      (u_counter + 100.0) / (u_counter_max + 100.0),
      0.0
    ),
    4.0
  );
  vec3 color = vec3(0.0, clamp(base_green, 0.0, 255.0), 0.0);

  float direction_y = mod(cell_x, 2.0) < 1.0
    ? cell_y
    : -cell_y;
  float raw_blue = floor(
    256.0 * (
      (cell_x + direction_y + u_counter * 0.5) / column_count
    ) + 0.5
  );
  if (raw_blue >= 0.0) {
    float rectangle_scale = pow(raw_blue / 256.0, 0.1);
    float rounded_counter = u_counter < 0.0
      ? ceil(u_counter - 0.5)
      : floor(u_counter + 0.5);
    vec2 local_position = vec2(
      fract(gl_FragCoord.x / cell_size_pixels),
      fract(canvas_y / cell_size_pixels)
    );
    if (
      local_position.x <= rectangle_scale &&
      local_position.y <= rectangle_scale
    ) {
      color = vec3(
        0.0,
        clamp(rounded_counter, 0.0, 255.0),
        clamp(raw_blue, 0.0, 255.0)
      );
    }
  }

  out_color = vec4(color / 255.0, 1.0);
}
`;

const OVERLAY_VERTEX_SHADER_SOURCE = `#version 300 es
precision highp float;

layout(location = 0) in vec2 a_position;

uniform vec2 u_canvas_size;
uniform float u_scale;

void main() {
  vec2 position_pixels = a_position * u_scale;
  vec2 clip_position = vec2(
    position_pixels.x / u_canvas_size.x * 2.0 - 1.0,
    1.0 - position_pixels.y / u_canvas_size.y * 2.0
  );
  gl_Position = vec4(clip_position, 0.0, 1.0);
}
`;

const OVERLAY_FRAGMENT_SHADER_SOURCE = `#version 300 es
precision highp float;

out vec4 out_color;

void main() {
  out_color = vec4(1.0);
}
`;

function nowMilliseconds() {
  return globalThis.performance?.now?.() ?? Date.now();
}

function compileShader( gl, type, source ) {
  const shader = gl.createShader( type );
  if ( !shader ) {
    throw new Error( 'WebGL2 failed to allocate a shader' );
  }
  gl.shaderSource( shader, source );
  gl.compileShader( shader );
  if ( !gl.getShaderParameter( shader, gl.COMPILE_STATUS ) ) {
    const message = gl.getShaderInfoLog( shader ) ?? 'unknown shader error';
    gl.deleteShader( shader );
    throw new Error( `WebGL2 shader compilation failed: ${message}` );
  }
  return shader;
}

function createProgram( gl, vertexSource, fragmentSource ) {
  const vertexShader = compileShader(
    gl,
    gl.VERTEX_SHADER,
    vertexSource,
  );
  const fragmentShader = compileShader(
    gl,
    gl.FRAGMENT_SHADER,
    fragmentSource,
  );
  const program = gl.createProgram();
  if ( !program ) {
    gl.deleteShader( vertexShader );
    gl.deleteShader( fragmentShader );
    throw new Error( 'WebGL2 failed to allocate a program' );
  }

  gl.attachShader( program, vertexShader );
  gl.attachShader( program, fragmentShader );
  gl.linkProgram( program );
  gl.deleteShader( vertexShader );
  gl.deleteShader( fragmentShader );
  if ( !gl.getProgramParameter( program, gl.LINK_STATUS ) ) {
    const message = gl.getProgramInfoLog( program ) ?? 'unknown link error';
    gl.deleteProgram( program );
    throw new Error( `WebGL2 program link failed: ${message}` );
  }
  return program;
}

function createBuffer( gl ) {
  const buffer = gl.createBuffer();
  if ( !buffer ) {
    throw new Error( 'WebGL2 failed to allocate a buffer' );
  }
  return buffer;
}

function createVertexArray( gl ) {
  const vertexArray = gl.createVertexArray();
  if ( !vertexArray ) {
    throw new Error( 'WebGL2 failed to allocate a vertex array' );
  }
  return vertexArray;
}

function requireUniform( gl, program, name ) {
  const location = gl.getUniformLocation( program, name );
  if ( location === null ) {
    throw new Error( `WebGL2 failed to locate renderer uniform ${name}` );
  }
  return location;
}

function clampColorChannel( value ) {
  const number = Number( value );
  if ( !Number.isFinite( number ) ) {
    return 0;
  }
  return Math.min( 255, Math.max( 0, Math.round( number ) ) );
}

function emptyCategoryStats( attemptedBodies ) {
  return {
    attemptedBodies,
    drawnBodies: 0,
    culledBodies: 0,
    pixelBodies: 0,
    circleBodies: 0,
    outlinedBodies: 0,
    packMs: 0,
  };
}

export class WebGL2Renderer
{
  constructor( canvas ) {
    const context = canvas.getContext( 'webgl2', {
      alpha: false,
      antialias: true,
      preserveDrawingBuffer: false,
    });
    if ( !context ) {
      throw new Error( 'WebGL2 is unavailable' );
    }

    this.backend = 'webgl2';
    this.canvas = canvas;
    this.context = context;
    this.disposed = false;
    const debugRendererInfo = context.getExtension(
      'WEBGL_debug_renderer_info',
    );
    this.graphicsInfo = Object.freeze({
      renderer: debugRendererInfo
        ? context.getParameter(
          debugRendererInfo.UNMASKED_RENDERER_WEBGL,
        )
        : context.getParameter( context.RENDERER ),
      shadingLanguageVersion: context.getParameter(
        context.SHADING_LANGUAGE_VERSION,
      ),
      vendor: debugRendererInfo
        ? context.getParameter(
          debugRendererInfo.UNMASKED_VENDOR_WEBGL,
        )
        : context.getParameter( context.VENDOR ),
      version: context.getParameter( context.VERSION ),
    });
    this.capabilities = Object.freeze({
      animatedBackground: true,
      debugOverlay: true,
      pizzaTexture: true,
      purpleMode: true,
      quadtreeOverlay: true,
    });

    const gl = this.context;
    this.program = createProgram(
      gl,
      CIRCLE_VERTEX_SHADER_SOURCE,
      CIRCLE_FRAGMENT_SHADER_SOURCE,
    );
    this.vertexArray = createVertexArray( gl );
    this.cornerBuffer = createBuffer( gl );
    this.circleBuffer = createBuffer( gl );
    this.colorBuffer = createBuffer( gl );
    this.outlineBuffer = createBuffer( gl );
    this.canvasSizeLocation = requireUniform(
      gl,
      this.program,
      'u_canvas_size',
    );
    this.scaleLocation = requireUniform(
      gl,
      this.program,
      'u_scale',
    );
    this.pizzaTextureLocation = requireUniform(
      gl,
      this.program,
      'u_pizza_texture',
    );
    this.pizzaTextureSizeLocation = requireUniform(
      gl,
      this.program,
      'u_pizza_texture_size',
    );
    this.usePizzaTextureLocation = requireUniform(
      gl,
      this.program,
      'u_use_pizza_texture',
    );

    gl.bindVertexArray( this.vertexArray );

    gl.bindBuffer( gl.ARRAY_BUFFER, this.cornerBuffer );
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([
        -1, -1,
         1, -1,
        -1,  1,
         1,  1,
      ]),
      gl.STATIC_DRAW,
    );
    gl.enableVertexAttribArray( 0 );
    gl.vertexAttribPointer( 0, 2, gl.FLOAT, false, 0, 0 );

    gl.bindBuffer( gl.ARRAY_BUFFER, this.circleBuffer );
    gl.enableVertexAttribArray( 1 );
    gl.vertexAttribPointer( 1, 3, gl.FLOAT, false, 0, 0 );
    gl.vertexAttribDivisor( 1, 1 );

    gl.bindBuffer( gl.ARRAY_BUFFER, this.colorBuffer );
    gl.enableVertexAttribArray( 2 );
    gl.vertexAttribPointer( 2, 4, gl.UNSIGNED_BYTE, true, 0, 0 );
    gl.vertexAttribDivisor( 2, 1 );

    gl.bindBuffer( gl.ARRAY_BUFFER, this.outlineBuffer );
    gl.enableVertexAttribArray( 3 );
    gl.vertexAttribPointer( 3, 1, gl.UNSIGNED_BYTE, false, 0, 0 );
    gl.vertexAttribDivisor( 3, 1 );

    this.backgroundProgram = createProgram(
      gl,
      BACKGROUND_VERTEX_SHADER_SOURCE,
      BACKGROUND_FRAGMENT_SHADER_SOURCE,
    );
    this.backgroundVertexArray = createVertexArray( gl );
    this.backgroundCanvasSizeLocation = requireUniform(
      gl,
      this.backgroundProgram,
      'u_canvas_size',
    );
    this.backgroundCounterLocation = requireUniform(
      gl,
      this.backgroundProgram,
      'u_counter',
    );
    this.backgroundCounterMaxLocation = requireUniform(
      gl,
      this.backgroundProgram,
      'u_counter_max',
    );

    this.overlayProgram = createProgram(
      gl,
      OVERLAY_VERTEX_SHADER_SOURCE,
      OVERLAY_FRAGMENT_SHADER_SOURCE,
    );
    this.overlayVertexArray = createVertexArray( gl );
    this.overlayBuffer = createBuffer( gl );
    this.overlayCanvasSizeLocation = requireUniform(
      gl,
      this.overlayProgram,
      'u_canvas_size',
    );
    this.overlayScaleLocation = requireUniform(
      gl,
      this.overlayProgram,
      'u_scale',
    );
    gl.bindVertexArray( this.overlayVertexArray );
    gl.bindBuffer( gl.ARRAY_BUFFER, this.overlayBuffer );
    gl.enableVertexAttribArray( 0 );
    gl.vertexAttribPointer( 0, 2, gl.FLOAT, false, 0, 0 );

    this.pizzaTexture = gl.createTexture();
    if ( !this.pizzaTexture ) {
      throw new Error( 'WebGL2 failed to allocate the pizza texture' );
    }
    gl.activeTexture( gl.TEXTURE0 );
    gl.bindTexture( gl.TEXTURE_2D, this.pizzaTexture );
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      1,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      new Uint8Array([ 255, 255, 255, 255 ]),
    );
    gl.texParameteri(
      gl.TEXTURE_2D,
      gl.TEXTURE_MIN_FILTER,
      gl.LINEAR,
    );
    gl.texParameteri(
      gl.TEXTURE_2D,
      gl.TEXTURE_MAG_FILTER,
      gl.LINEAR,
    );
    gl.texParameteri(
      gl.TEXTURE_2D,
      gl.TEXTURE_WRAP_S,
      gl.REPEAT,
    );
    gl.texParameteri(
      gl.TEXTURE_2D,
      gl.TEXTURE_WRAP_T,
      gl.REPEAT,
    );

    gl.bindTexture( gl.TEXTURE_2D, null );
    gl.bindVertexArray( null );
    gl.bindBuffer( gl.ARRAY_BUFFER, null );

    gl.disable( gl.DEPTH_TEST );
    gl.disable( gl.CULL_FACE );
    gl.enable( gl.BLEND );
    gl.blendFunc( gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA );
    gl.clearColor( 0, 0, 0, 1 );

    this.capacity = 0;
    this.circles = new Float32Array();
    this.colors = new Uint8Array();
    this.outlines = new Uint8Array();
    this.overlayVertexCapacity = 0;
    this.overlayPositions = new Float32Array();
    this.overlayStack = [];
    this.pizzaImage = null;
    this.pizzaTextureReady = false;
    this.pizzaTextureError = null;
    this.pizzaTextureWidth = 1;
    this.pizzaTextureHeight = 1;
    this.ensureCapacity( INITIAL_INSTANCE_CAPACITY );
    this.ensureOverlayCapacity( INITIAL_OVERLAY_VERTEX_CAPACITY );
  }

  resize( width, height ) {
    if ( this.canvas.width !== width ) {
      this.canvas.width = width;
    }
    if ( this.canvas.height !== height ) {
      this.canvas.height = height;
    }
    this.context.viewport( 0, 0, this.canvas.width, this.canvas.height );
  }

  ensureCapacity( requiredCapacity ) {
    if ( requiredCapacity <= this.capacity ) {
      return;
    }

    let nextCapacity = Math.max(
      INITIAL_INSTANCE_CAPACITY,
      this.capacity || INITIAL_INSTANCE_CAPACITY,
    );
    while ( nextCapacity < requiredCapacity ) {
      nextCapacity *= 2;
    }

    this.capacity = nextCapacity;
    this.circles = new Float32Array( this.capacity * 3 );
    this.colors = new Uint8Array( this.capacity * 4 );
    this.outlines = new Uint8Array( this.capacity );

    const gl = this.context;
    gl.bindBuffer( gl.ARRAY_BUFFER, this.circleBuffer );
    gl.bufferData(
      gl.ARRAY_BUFFER,
      this.circles.byteLength,
      gl.DYNAMIC_DRAW,
    );
    gl.bindBuffer( gl.ARRAY_BUFFER, this.colorBuffer );
    gl.bufferData(
      gl.ARRAY_BUFFER,
      this.colors.byteLength,
      gl.DYNAMIC_DRAW,
    );
    gl.bindBuffer( gl.ARRAY_BUFFER, this.outlineBuffer );
    gl.bufferData(
      gl.ARRAY_BUFFER,
      this.outlines.byteLength,
      gl.DYNAMIC_DRAW,
    );
    gl.bindBuffer( gl.ARRAY_BUFFER, null );
  }

  ensureOverlayCapacity( requiredVertexCapacity ) {
    if ( requiredVertexCapacity <= this.overlayVertexCapacity ) {
      return;
    }

    let nextCapacity = Math.max(
      INITIAL_OVERLAY_VERTEX_CAPACITY,
      this.overlayVertexCapacity || INITIAL_OVERLAY_VERTEX_CAPACITY,
    );
    while ( nextCapacity < requiredVertexCapacity ) {
      nextCapacity *= 2;
    }

    const previousPositions = this.overlayPositions;
    this.overlayVertexCapacity = nextCapacity;
    const nextPositions = new Float32Array(
      this.overlayVertexCapacity * 2,
    );
    nextPositions.set( previousPositions );
    this.overlayPositions = nextPositions;
    const gl = this.context;
    gl.bindBuffer( gl.ARRAY_BUFFER, this.overlayBuffer );
    gl.bufferData(
      gl.ARRAY_BUFFER,
      this.overlayPositions.byteLength,
      gl.DYNAMIC_DRAW,
    );
    gl.bindBuffer( gl.ARRAY_BUFFER, null );
  }

  ensurePizzaTextureLoaded() {
    if (
      this.pizzaImage ||
      this.pizzaTextureReady ||
      this.pizzaTextureError ||
      typeof Image === 'undefined'
    ) {
      return;
    }

    const image = new Image();
    this.pizzaImage = image;
    image.onload = () => {
      if ( this.disposed || this.context.isContextLost() ) {
        return;
      }
      try {
        const gl = this.context;
        gl.activeTexture( gl.TEXTURE0 );
        gl.bindTexture( gl.TEXTURE_2D, this.pizzaTexture );
        gl.pixelStorei( gl.UNPACK_FLIP_Y_WEBGL, false );
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          image,
        );
        gl.bindTexture( gl.TEXTURE_2D, null );
        this.pizzaTextureWidth = image.naturalWidth;
        this.pizzaTextureHeight = image.naturalHeight;
        this.pizzaTextureReady = true;
      } catch ( error ) {
        this.pizzaTextureError = error instanceof Error
          ? error.message
          : String( error );
      }
    };
    image.onerror = () => {
      this.pizzaTextureError = 'Pizza texture failed to load';
    };
    image.src = PIZZA_IMAGE_URL;
  }

  packBodies(
    world,
    bodies,
    scale,
    startIndex,
    useParticleLod,
    useOutlineLod,
  ) {
    const packStart = nowMilliseconds();
    const stats = emptyCategoryStats( bodies.length );
    const width = this.canvas.width;
    const height = this.canvas.height;
    let instanceIndex = startIndex;

    for ( const body of bodies ) {
      const x = body.center.x * scale;
      const y = body.center.y * scale;
      const radiusPixels = body.r * scale;
      if (
        x + radiusPixels < 0 ||
        y + radiusPixels < 0 ||
        x - radiusPixels > width ||
        y - radiusPixels > height
      ) {
        stats.culledBodies++;
        continue;
      }

      const isPixelBody = (
        useParticleLod &&
        radiusPixels <= PARTICLE_PIXEL_RADIUS
      );
      const radius = isPixelBody
        ? Math.max( body.r, 0.5 / scale )
        : body.r;
      const shouldOutline = (
        !isPixelBody &&
        world.renderOutlines &&
        ( !useOutlineLod || radiusPixels >= world.highLoadOutlineRadius )
      );
      const circleOffset = instanceIndex * 3;
      this.circles[ circleOffset ] = body.center.x;
      this.circles[ circleOffset + 1 ] = body.center.y;
      this.circles[ circleOffset + 2 ] = radius;

      const colorOffset = instanceIndex * 4;
      if ( world.renderFillStyleOverride ) {
        this.colors[ colorOffset ] = 128;
        this.colors[ colorOffset + 1 ] = 128;
        this.colors[ colorOffset + 2 ] = 128;
      } else {
        this.colors[ colorOffset ] = clampColorChannel( body.color.x );
        this.colors[ colorOffset + 1 ] = clampColorChannel( body.color.y );
        this.colors[ colorOffset + 2 ] = clampColorChannel( body.color.z );
      }
      this.colors[ colorOffset + 3 ] = 255;
      this.outlines[ instanceIndex ] = shouldOutline ? 1 : 0;

      stats.drawnBodies++;
      if ( isPixelBody ) {
        stats.pixelBodies++;
      } else {
        stats.circleBodies++;
      }
      if ( shouldOutline ) {
        stats.outlinedBodies++;
      }
      instanceIndex++;
    }

    stats.packMs = nowMilliseconds() - packStart;
    return {
      nextIndex: instanceIndex,
      stats,
    };
  }

  packOverlay( tree ) {
    let nodeCount = 0;
    let vertexCount = 0;
    const nodes = this.overlayStack;
    nodes.length = 0;
    nodes.push( tree );

    while ( nodes.length > 0 ) {
      const node = nodes.pop();
      this.ensureOverlayCapacity( vertexCount + 8 );
      const offset = vertexCount * 2;
      const minX = node.min_x;
      const minY = node.min_y;
      const maxX = node.max_x;
      const maxY = node.max_y;
      const positions = this.overlayPositions;
      positions[ offset ] = minX;
      positions[ offset + 1 ] = minY;
      positions[ offset + 2 ] = maxX;
      positions[ offset + 3 ] = minY;
      positions[ offset + 4 ] = maxX;
      positions[ offset + 5 ] = minY;
      positions[ offset + 6 ] = maxX;
      positions[ offset + 7 ] = maxY;
      positions[ offset + 8 ] = maxX;
      positions[ offset + 9 ] = maxY;
      positions[ offset + 10 ] = minX;
      positions[ offset + 11 ] = maxY;
      positions[ offset + 12 ] = minX;
      positions[ offset + 13 ] = maxY;
      positions[ offset + 14 ] = minX;
      positions[ offset + 15 ] = minY;
      vertexCount += 8;
      nodeCount++;

      for ( let index = node.children.length - 1; index >= 0; index-- ) {
        nodes.push( node.children[ index ] );
      }
    }

    return {
      nodeCount,
      vertexCount,
    };
  }

  drawBackground( background ) {
    const gl = this.context;
    gl.useProgram( this.backgroundProgram );
    gl.uniform2f(
      this.backgroundCanvasSizeLocation,
      this.canvas.width,
      this.canvas.height,
    );
    gl.uniform1f( this.backgroundCounterLocation, background.counter );
    gl.uniform1f(
      this.backgroundCounterMaxLocation,
      background.counterMax,
    );
    gl.bindVertexArray( this.backgroundVertexArray );
    gl.drawArrays( gl.TRIANGLES, 0, 3 );
    background.updateRgb();
  }

  drawBodies( world, scale, instanceCount ) {
    if ( instanceCount === 0 ) {
      return;
    }

    const gl = this.context;
    const usePizzaTexture = (
      world.pizza_time &&
      this.pizzaTextureReady
    );
    gl.useProgram( this.program );
    gl.uniform2f(
      this.canvasSizeLocation,
      this.canvas.width,
      this.canvas.height,
    );
    gl.uniform1f( this.scaleLocation, scale );
    gl.uniform1i( this.pizzaTextureLocation, 0 );
    gl.uniform2f(
      this.pizzaTextureSizeLocation,
      this.pizzaTextureWidth,
      this.pizzaTextureHeight,
    );
    gl.uniform1i( this.usePizzaTextureLocation, usePizzaTexture ? 1 : 0 );
    gl.activeTexture( gl.TEXTURE0 );
    gl.bindTexture( gl.TEXTURE_2D, this.pizzaTexture );
    gl.bindVertexArray( this.vertexArray );
    gl.drawArraysInstanced(
      gl.TRIANGLE_STRIP,
      0,
      4,
      instanceCount,
    );
  }

  drawOverlay( tree, scale ) {
    const packed = this.packOverlay( tree );
    const gl = this.context;
    gl.bindBuffer( gl.ARRAY_BUFFER, this.overlayBuffer );
    gl.bufferSubData(
      gl.ARRAY_BUFFER,
      0,
      this.overlayPositions.subarray( 0, packed.vertexCount * 2 ),
    );
    gl.useProgram( this.overlayProgram );
    gl.uniform2f(
      this.overlayCanvasSizeLocation,
      this.canvas.width,
      this.canvas.height,
    );
    gl.uniform1f( this.overlayScaleLocation, scale );
    gl.bindVertexArray( this.overlayVertexArray );
    gl.drawArrays( gl.LINES, 0, packed.vertexCount );
    return packed;
  }

  render( world ) {
    const renderStart = nowMilliseconds();
    const attemptedBodies = (
      world.particles.length +
      world.planets.length +
      world.balls.length
    );
    const useOutlineLod = (
      world.adaptiveOutlines &&
      attemptedBodies > world.maxFullOutlineBodyCount
    );
    const scale = world.getDrawScale( this.canvas );
    this.ensureCapacity( attemptedBodies );

    if ( world.pizza_time ) {
      this.ensurePizzaTextureLoaded();
    }

    let instanceCount = 0;
    const particles = this.packBodies(
      world,
      world.particles,
      scale,
      instanceCount,
      true,
      useOutlineLod,
    );
    instanceCount = particles.nextIndex;
    const planets = this.packBodies(
      world,
      world.planets,
      scale,
      instanceCount,
      false,
      useOutlineLod,
    );
    instanceCount = planets.nextIndex;
    const balls = this.packBodies(
      world,
      world.balls,
      scale,
      instanceCount,
      false,
      useOutlineLod,
    );
    instanceCount = balls.nextIndex;
    const packEnd = nowMilliseconds();

    const gl = this.context;
    const uploadStart = packEnd;
    if ( instanceCount > 0 ) {
      gl.bindBuffer( gl.ARRAY_BUFFER, this.circleBuffer );
      gl.bufferSubData(
        gl.ARRAY_BUFFER,
        0,
        this.circles.subarray( 0, instanceCount * 3 ),
      );
      gl.bindBuffer( gl.ARRAY_BUFFER, this.colorBuffer );
      gl.bufferSubData(
        gl.ARRAY_BUFFER,
        0,
        this.colors.subarray( 0, instanceCount * 4 ),
      );
      gl.bindBuffer( gl.ARRAY_BUFFER, this.outlineBuffer );
      gl.bufferSubData(
        gl.ARRAY_BUFFER,
        0,
        this.outlines.subarray( 0, instanceCount ),
      );
    }
    const uploadEnd = nowMilliseconds();

    gl.clear( gl.COLOR_BUFFER_BIT );
    const backgroundStart = nowMilliseconds();
    if ( world.shouldDrawBackground ) {
      this.drawBackground( world.background );
    }
    const backgroundEnd = nowMilliseconds();

    this.drawBodies( world, scale, instanceCount );
    const bodiesEnd = nowMilliseconds();

    const overlayStart = bodiesEnd;
    let overlayNodeCount = 0;
    let overlayVertexCount = 0;
    if ( world.showQuadtreeOverlay && world.lastQuadtree ) {
      if ( debug_on ) {
        console.log( world.lastQuadtree.toS() );
        if ( world.quadtreeRejected.length > 0 ) {
          console.warn(
            'quadtree rejected ' +
            world.quadtreeRejected.length +
            ' ball(s)',
          );
        }
      }
      const overlay = this.drawOverlay( world.lastQuadtree, scale );
      overlayNodeCount = overlay.nodeCount;
      overlayVertexCount = overlay.vertexCount;
    }
    gl.bindTexture( gl.TEXTURE_2D, null );
    gl.bindVertexArray( null );
    gl.bindBuffer( gl.ARRAY_BUFFER, null );
    gl.flush();
    const renderEnd = nowMilliseconds();

    const categoryStats = [
      particles.stats,
      planets.stats,
      balls.stats,
    ];
    const sum = property => categoryStats.reduce(
      ( total, stats ) => total + stats[ property ],
      0,
    );
    const bodyCpuBufferBytes = (
      this.circles.byteLength +
      this.colors.byteLength +
      this.outlines.byteLength
    );
    const breakdown = {
      backend: this.backend,
      totalMs: renderEnd - renderStart,
      backgroundMs: backgroundEnd - backgroundStart,
      particleMs: particles.stats.packMs,
      planetMs: planets.stats.packMs,
      ballMs: balls.stats.packMs,
      overlayMs: renderEnd - overlayStart,
      packMs: packEnd - renderStart,
      uploadMs: uploadEnd - uploadStart,
      submitMs: renderEnd - uploadEnd,
      outlineLodActive: useOutlineLod,
      attemptedBodies,
      drawnBodies: sum( 'drawnBodies' ),
      culledBodies: sum( 'culledBodies' ),
      pixelBodies: sum( 'pixelBodies' ),
      circleBodies: sum( 'circleBodies' ),
      outlinedBodies: sum( 'outlinedBodies' ),
      bufferCapacity: this.capacity,
      overlayNodeCount,
      overlayVertexCount,
      overlayVertexCapacity: this.overlayVertexCapacity,
      pizzaTextureReady: this.pizzaTextureReady,
      cpuBufferBytes: (
        bodyCpuBufferBytes +
        this.overlayPositions.byteLength
      ),
      gpuBufferBytes: (
        bodyCpuBufferBytes +
        this.overlayPositions.byteLength
      ),
      particles: particles.stats,
      planets: planets.stats,
      balls: balls.stats,
    };
    world.lastRenderBreakdown = breakdown;
    return breakdown;
  }

  synchronize() {
    const start = nowMilliseconds();
    this.context.finish();
    return nowMilliseconds() - start;
  }

  dispose() {
    this.disposed = true;
    if ( this.pizzaImage ) {
      this.pizzaImage.onload = null;
      this.pizzaImage.onerror = null;
    }
    const gl = this.context;
    gl.deleteTexture( this.pizzaTexture );
    gl.deleteBuffer( this.cornerBuffer );
    gl.deleteBuffer( this.circleBuffer );
    gl.deleteBuffer( this.colorBuffer );
    gl.deleteBuffer( this.outlineBuffer );
    gl.deleteBuffer( this.overlayBuffer );
    gl.deleteVertexArray( this.vertexArray );
    gl.deleteVertexArray( this.backgroundVertexArray );
    gl.deleteVertexArray( this.overlayVertexArray );
    gl.deleteProgram( this.program );
    gl.deleteProgram( this.backgroundProgram );
    gl.deleteProgram( this.overlayProgram );
  }
}
