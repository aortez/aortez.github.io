var gulp = require('gulp');

var scripts = [
  './src/scripts/vec3.js',
  './src/scripts/controller.js',
  './src/scripts/background.js',
  './src/scripts/ball.js',
  './src/scripts/vec2.js',
  './src/scripts/world.js',
  './src/scripts/spaceWorld.js',
  './src/scripts/view.js',
  './src/scripts/new_main.js'
];

// lint
var jshint = require('gulp-jshint');
gulp.task('jshint', function() {
  gulp.src(scripts)
    .pipe(jshint())
    .pipe(jshint.reporter('default'));
});

// combine scripts
var concat = require('gulp-concat');
gulp.task('scripts', function() {
  gulp.src(scripts)
    .pipe(concat('script.js'))
    .pipe(gulp.dest('./build/scripts/'));
});

// default task
gulp.task('default', ['jshint', 'scripts'], function() {});
// gulp.task('default', ['jshint'], function() {});
