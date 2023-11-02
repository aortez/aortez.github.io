const { src, dest, series } = require('gulp');
const concat = require('gulp-concat');
const jshint = require('gulp-jshint');

// The `clean` function is not exported so it can be considered a private task.
// It can still be used within the `series()` composition.
function clean(cb) {
  cb();
}

function lint(cb) {
  src('./src/scripts/*.js')
  .pipe(jshint())
  .pipe(jshint.reporter('default'));

  cb();
}

function build(cb) {
  src([
    './src/scripts/utils.js',
    './src/scripts/vec3.js',
    './src/scripts/vec2.js',
    './src/scripts/quadtree.js',
    './src/scripts/controller.js',
    './src/scripts/background.js',
    './src/scripts/ball.js',
    './src/scripts/world.js',
    './src/scripts/main.js'
  ])
  .pipe(concat('script.js'))
  .pipe(dest('./build/scripts'));

  cb();
}

exports.build = build;
// exports.default = series(clean, build);
exports.default = series(lint, clean, build);