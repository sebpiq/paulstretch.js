This is a JavaScript implementation of *Paul's Extreme Sound Stretch* (Paulstretch) by **Nasca Octavian PAUL** (original implementations : [python version](https://github.com/paulnasca/paulstretch_python) [standalone tool](http://hypermammut.sourceforge.net/paulstretch/)).

Run tests
==============

Tests are written with mocha.

```
mocha -t 15000
```

Build
=======

```
browserify index.js > dist/paulstretch.js
```