This is a JavaScript implementation, with a few improvements of *Paul's Extreme Sound Stretch algorithm* (Paulstretch) by **Nasca Octavian PAUL** (original implementations : [python version](https://github.com/paulnasca/paulstretch_python) [standalone tool](http://hypermammut.sourceforge.net/paulstretch/)).


Examples
==========

Simple example, just stretching a sample : http://sebpiq.github.io/paulstretch.js/examples/simple/index.html
More fun example, creating drones with tracks from SoundCloud : http://sebpiq.github.io/paulstretch.js/examples/stretched-and-droned/dist/index.html

Run tests
==============

Tests are written with mocha.

```
mocha -t 15000
```

Build
=======

```
npm install
browserify index.js > dist/paulstretch.js
```