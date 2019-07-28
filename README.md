This is a JavaScript implementation - with a few improvements - of *Paul's Extreme Sound Stretch algorithm* (Paulstretch) by [Nasca Octavian PAUL](https://github.com/paulnasca).

Install
===========

Just download the latest build in [dist/](https://github.com/sebpiq/paulstretch.js/tree/master/dist) , and add it to your html page.


Examples
==========
- Example, stretching a sample from a web worker : http://sebpiq.github.io/paulstretch.js/examples/simple/index.html
- More fun example, creating drones with tracks from SoundCloud : http://sebpiq.github.io/paulstretch.js/examples/expendable-music/dist/index.html

Run tests
==============

Tests are written with mocha.

```
npx mocha test/ examples/expendable-music/test/ -t 15000
```

Build
=======

Build library
--------------

```
npm install
browserify index.js > dist/paulstretch.js
```

Build examples
---------------

```
npx browserify examples/expendable-music/src/index.js > examples/expendable-music/dist/js/expendable-music.js 
npx browserify index.js > examples/expendable-music/dist/js/paulstretch.js 
```