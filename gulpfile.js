// include gulp
var gulp = require('gulp');

// include plug-ins
var jshint = require('gulp-jshint');

// JS hint task
gulp.task('jshint', function() {
  gulp.src('./src/scripts/*.js')
    .pipe(jshint())
    .pipe(jshint.reporter('default'));
});

// include plug-ins
var concat = require('gulp-concat');

// JS concat, strip debugging and minify
gulp.task('scripts', function() {
  gulp.src([
    './src/scripts/vec3.js',
    './src/scripts/all.js',
    './src/scripts/ball.js',
    './src/scripts/vec2.js',
    './src/scripts/world.js'
  ])
    .pipe(concat('script.js'))
    .pipe(gulp.dest('./build/scripts/'));
});

// default gulp task
gulp.task('default', ['jshint', 'scripts'], function() {
});
