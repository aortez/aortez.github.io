var gulp = require('gulp');

var jshint = require('gulp-jshint');
gulp.task('jshint', function() {
  gulp.src('./src/scripts/*.js')
    .pipe(jshint())
    .pipe(jshint.reporter('default'));
});

var concat = require('gulp-concat');
gulp.task('scripts', function() {
  gulp.src([
    './src/scripts/vec3.js',
    './src/scripts/controller.js',
    './src/scripts/background.js',
    './src/scripts/ball.js',
    './src/scripts/vec2.js',
    './src/scripts/world.js',
    './src/scripts/main.js'
  ])
    .pipe(concat('script.js'))
    .pipe(gulp.dest('./build/scripts/'));
});

// default task
gulp.task('default', ['jshint', 'scripts'], function() {});
