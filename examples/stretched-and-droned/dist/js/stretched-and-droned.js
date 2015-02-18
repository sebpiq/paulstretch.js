(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      } else {
        throw TypeError('Uncaught, unspecified "error" event.');
      }
      return false;
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        len = arguments.length;
        args = new Array(len - 1);
        for (i = 1; i < len; i++)
          args[i - 1] = arguments[i];
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    len = arguments.length;
    args = new Array(len - 1);
    for (i = 1; i < len; i++)
      args[i - 1] = arguments[i];

    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    var m;
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.listenerCount = function(emitter, type) {
  var ret;
  if (!emitter._events || !emitter._events[type])
    ret = 0;
  else if (isFunction(emitter._events[type]))
    ret = 1;
  else
    ret = emitter._events[type].length;
  return ret;
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],2:[function(require,module,exports){
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    var TempCtor = function () {}
    TempCtor.prototype = superCtor.prototype
    ctor.prototype = new TempCtor()
    ctor.prototype.constructor = ctor
  }
}

},{}],3:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};

process.nextTick = (function () {
    var canSetImmediate = typeof window !== 'undefined'
    && window.setImmediate;
    var canPost = typeof window !== 'undefined'
    && window.postMessage && window.addEventListener
    ;

    if (canSetImmediate) {
        return function (f) { return window.setImmediate(f) };
    }

    if (canPost) {
        var queue = [];
        window.addEventListener('message', function (ev) {
            var source = ev.source;
            if ((source === window || source === null) && ev.data === 'process-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);

        return function nextTick(fn) {
            queue.push(fn);
            window.postMessage('process-tick', '*');
        };
    }

    return function nextTick(fn) {
        setTimeout(fn, 0);
    };
})();

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
}

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};

},{}],4:[function(require,module,exports){
module.exports = function isBuffer(arg) {
  return arg && typeof arg === 'object'
    && typeof arg.copy === 'function'
    && typeof arg.fill === 'function'
    && typeof arg.readUInt8 === 'function';
}
},{}],5:[function(require,module,exports){
(function (process,global){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var formatRegExp = /%[sdj%]/g;
exports.format = function(f) {
  if (!isString(f)) {
    var objects = [];
    for (var i = 0; i < arguments.length; i++) {
      objects.push(inspect(arguments[i]));
    }
    return objects.join(' ');
  }

  var i = 1;
  var args = arguments;
  var len = args.length;
  var str = String(f).replace(formatRegExp, function(x) {
    if (x === '%%') return '%';
    if (i >= len) return x;
    switch (x) {
      case '%s': return String(args[i++]);
      case '%d': return Number(args[i++]);
      case '%j':
        try {
          return JSON.stringify(args[i++]);
        } catch (_) {
          return '[Circular]';
        }
      default:
        return x;
    }
  });
  for (var x = args[i]; i < len; x = args[++i]) {
    if (isNull(x) || !isObject(x)) {
      str += ' ' + x;
    } else {
      str += ' ' + inspect(x);
    }
  }
  return str;
};


// Mark that a method should not be used.
// Returns a modified function which warns once by default.
// If --no-deprecation is set, then it is a no-op.
exports.deprecate = function(fn, msg) {
  // Allow for deprecating things in the process of starting up.
  if (isUndefined(global.process)) {
    return function() {
      return exports.deprecate(fn, msg).apply(this, arguments);
    };
  }

  if (process.noDeprecation === true) {
    return fn;
  }

  var warned = false;
  function deprecated() {
    if (!warned) {
      if (process.throwDeprecation) {
        throw new Error(msg);
      } else if (process.traceDeprecation) {
        console.trace(msg);
      } else {
        console.error(msg);
      }
      warned = true;
    }
    return fn.apply(this, arguments);
  }

  return deprecated;
};


var debugs = {};
var debugEnviron;
exports.debuglog = function(set) {
  if (isUndefined(debugEnviron))
    debugEnviron = process.env.NODE_DEBUG || '';
  set = set.toUpperCase();
  if (!debugs[set]) {
    if (new RegExp('\\b' + set + '\\b', 'i').test(debugEnviron)) {
      var pid = process.pid;
      debugs[set] = function() {
        var msg = exports.format.apply(exports, arguments);
        console.error('%s %d: %s', set, pid, msg);
      };
    } else {
      debugs[set] = function() {};
    }
  }
  return debugs[set];
};


/**
 * Echos the value of a value. Trys to print the value out
 * in the best way possible given the different types.
 *
 * @param {Object} obj The object to print out.
 * @param {Object} opts Optional options object that alters the output.
 */
/* legacy: obj, showHidden, depth, colors*/
function inspect(obj, opts) {
  // default options
  var ctx = {
    seen: [],
    stylize: stylizeNoColor
  };
  // legacy...
  if (arguments.length >= 3) ctx.depth = arguments[2];
  if (arguments.length >= 4) ctx.colors = arguments[3];
  if (isBoolean(opts)) {
    // legacy...
    ctx.showHidden = opts;
  } else if (opts) {
    // got an "options" object
    exports._extend(ctx, opts);
  }
  // set default options
  if (isUndefined(ctx.showHidden)) ctx.showHidden = false;
  if (isUndefined(ctx.depth)) ctx.depth = 2;
  if (isUndefined(ctx.colors)) ctx.colors = false;
  if (isUndefined(ctx.customInspect)) ctx.customInspect = true;
  if (ctx.colors) ctx.stylize = stylizeWithColor;
  return formatValue(ctx, obj, ctx.depth);
}
exports.inspect = inspect;


// http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
inspect.colors = {
  'bold' : [1, 22],
  'italic' : [3, 23],
  'underline' : [4, 24],
  'inverse' : [7, 27],
  'white' : [37, 39],
  'grey' : [90, 39],
  'black' : [30, 39],
  'blue' : [34, 39],
  'cyan' : [36, 39],
  'green' : [32, 39],
  'magenta' : [35, 39],
  'red' : [31, 39],
  'yellow' : [33, 39]
};

// Don't use 'blue' not visible on cmd.exe
inspect.styles = {
  'special': 'cyan',
  'number': 'yellow',
  'boolean': 'yellow',
  'undefined': 'grey',
  'null': 'bold',
  'string': 'green',
  'date': 'magenta',
  // "name": intentionally not styling
  'regexp': 'red'
};


function stylizeWithColor(str, styleType) {
  var style = inspect.styles[styleType];

  if (style) {
    return '\u001b[' + inspect.colors[style][0] + 'm' + str +
           '\u001b[' + inspect.colors[style][1] + 'm';
  } else {
    return str;
  }
}


function stylizeNoColor(str, styleType) {
  return str;
}


function arrayToHash(array) {
  var hash = {};

  array.forEach(function(val, idx) {
    hash[val] = true;
  });

  return hash;
}


function formatValue(ctx, value, recurseTimes) {
  // Provide a hook for user-specified inspect functions.
  // Check that value is an object with an inspect function on it
  if (ctx.customInspect &&
      value &&
      isFunction(value.inspect) &&
      // Filter out the util module, it's inspect function is special
      value.inspect !== exports.inspect &&
      // Also filter out any prototype objects using the circular check.
      !(value.constructor && value.constructor.prototype === value)) {
    var ret = value.inspect(recurseTimes, ctx);
    if (!isString(ret)) {
      ret = formatValue(ctx, ret, recurseTimes);
    }
    return ret;
  }

  // Primitive types cannot have properties
  var primitive = formatPrimitive(ctx, value);
  if (primitive) {
    return primitive;
  }

  // Look up the keys of the object.
  var keys = Object.keys(value);
  var visibleKeys = arrayToHash(keys);

  if (ctx.showHidden) {
    keys = Object.getOwnPropertyNames(value);
  }

  // IE doesn't make error fields non-enumerable
  // http://msdn.microsoft.com/en-us/library/ie/dww52sbt(v=vs.94).aspx
  if (isError(value)
      && (keys.indexOf('message') >= 0 || keys.indexOf('description') >= 0)) {
    return formatError(value);
  }

  // Some type of object without properties can be shortcutted.
  if (keys.length === 0) {
    if (isFunction(value)) {
      var name = value.name ? ': ' + value.name : '';
      return ctx.stylize('[Function' + name + ']', 'special');
    }
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    }
    if (isDate(value)) {
      return ctx.stylize(Date.prototype.toString.call(value), 'date');
    }
    if (isError(value)) {
      return formatError(value);
    }
  }

  var base = '', array = false, braces = ['{', '}'];

  // Make Array say that they are Array
  if (isArray(value)) {
    array = true;
    braces = ['[', ']'];
  }

  // Make functions say that they are functions
  if (isFunction(value)) {
    var n = value.name ? ': ' + value.name : '';
    base = ' [Function' + n + ']';
  }

  // Make RegExps say that they are RegExps
  if (isRegExp(value)) {
    base = ' ' + RegExp.prototype.toString.call(value);
  }

  // Make dates with properties first say the date
  if (isDate(value)) {
    base = ' ' + Date.prototype.toUTCString.call(value);
  }

  // Make error with message first say the error
  if (isError(value)) {
    base = ' ' + formatError(value);
  }

  if (keys.length === 0 && (!array || value.length == 0)) {
    return braces[0] + base + braces[1];
  }

  if (recurseTimes < 0) {
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    } else {
      return ctx.stylize('[Object]', 'special');
    }
  }

  ctx.seen.push(value);

  var output;
  if (array) {
    output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
  } else {
    output = keys.map(function(key) {
      return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
    });
  }

  ctx.seen.pop();

  return reduceToSingleString(output, base, braces);
}


function formatPrimitive(ctx, value) {
  if (isUndefined(value))
    return ctx.stylize('undefined', 'undefined');
  if (isString(value)) {
    var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
                                             .replace(/'/g, "\\'")
                                             .replace(/\\"/g, '"') + '\'';
    return ctx.stylize(simple, 'string');
  }
  if (isNumber(value))
    return ctx.stylize('' + value, 'number');
  if (isBoolean(value))
    return ctx.stylize('' + value, 'boolean');
  // For some reason typeof null is "object", so special case here.
  if (isNull(value))
    return ctx.stylize('null', 'null');
}


function formatError(value) {
  return '[' + Error.prototype.toString.call(value) + ']';
}


function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
  var output = [];
  for (var i = 0, l = value.length; i < l; ++i) {
    if (hasOwnProperty(value, String(i))) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          String(i), true));
    } else {
      output.push('');
    }
  }
  keys.forEach(function(key) {
    if (!key.match(/^\d+$/)) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          key, true));
    }
  });
  return output;
}


function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
  var name, str, desc;
  desc = Object.getOwnPropertyDescriptor(value, key) || { value: value[key] };
  if (desc.get) {
    if (desc.set) {
      str = ctx.stylize('[Getter/Setter]', 'special');
    } else {
      str = ctx.stylize('[Getter]', 'special');
    }
  } else {
    if (desc.set) {
      str = ctx.stylize('[Setter]', 'special');
    }
  }
  if (!hasOwnProperty(visibleKeys, key)) {
    name = '[' + key + ']';
  }
  if (!str) {
    if (ctx.seen.indexOf(desc.value) < 0) {
      if (isNull(recurseTimes)) {
        str = formatValue(ctx, desc.value, null);
      } else {
        str = formatValue(ctx, desc.value, recurseTimes - 1);
      }
      if (str.indexOf('\n') > -1) {
        if (array) {
          str = str.split('\n').map(function(line) {
            return '  ' + line;
          }).join('\n').substr(2);
        } else {
          str = '\n' + str.split('\n').map(function(line) {
            return '   ' + line;
          }).join('\n');
        }
      }
    } else {
      str = ctx.stylize('[Circular]', 'special');
    }
  }
  if (isUndefined(name)) {
    if (array && key.match(/^\d+$/)) {
      return str;
    }
    name = JSON.stringify('' + key);
    if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
      name = name.substr(1, name.length - 2);
      name = ctx.stylize(name, 'name');
    } else {
      name = name.replace(/'/g, "\\'")
                 .replace(/\\"/g, '"')
                 .replace(/(^"|"$)/g, "'");
      name = ctx.stylize(name, 'string');
    }
  }

  return name + ': ' + str;
}


function reduceToSingleString(output, base, braces) {
  var numLinesEst = 0;
  var length = output.reduce(function(prev, cur) {
    numLinesEst++;
    if (cur.indexOf('\n') >= 0) numLinesEst++;
    return prev + cur.replace(/\u001b\[\d\d?m/g, '').length + 1;
  }, 0);

  if (length > 60) {
    return braces[0] +
           (base === '' ? '' : base + '\n ') +
           ' ' +
           output.join(',\n  ') +
           ' ' +
           braces[1];
  }

  return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
}


// NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.
function isArray(ar) {
  return Array.isArray(ar);
}
exports.isArray = isArray;

function isBoolean(arg) {
  return typeof arg === 'boolean';
}
exports.isBoolean = isBoolean;

function isNull(arg) {
  return arg === null;
}
exports.isNull = isNull;

function isNullOrUndefined(arg) {
  return arg == null;
}
exports.isNullOrUndefined = isNullOrUndefined;

function isNumber(arg) {
  return typeof arg === 'number';
}
exports.isNumber = isNumber;

function isString(arg) {
  return typeof arg === 'string';
}
exports.isString = isString;

function isSymbol(arg) {
  return typeof arg === 'symbol';
}
exports.isSymbol = isSymbol;

function isUndefined(arg) {
  return arg === void 0;
}
exports.isUndefined = isUndefined;

function isRegExp(re) {
  return isObject(re) && objectToString(re) === '[object RegExp]';
}
exports.isRegExp = isRegExp;

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}
exports.isObject = isObject;

function isDate(d) {
  return isObject(d) && objectToString(d) === '[object Date]';
}
exports.isDate = isDate;

function isError(e) {
  return isObject(e) &&
      (objectToString(e) === '[object Error]' || e instanceof Error);
}
exports.isError = isError;

function isFunction(arg) {
  return typeof arg === 'function';
}
exports.isFunction = isFunction;

function isPrimitive(arg) {
  return arg === null ||
         typeof arg === 'boolean' ||
         typeof arg === 'number' ||
         typeof arg === 'string' ||
         typeof arg === 'symbol' ||  // ES6 symbol
         typeof arg === 'undefined';
}
exports.isPrimitive = isPrimitive;

exports.isBuffer = require('./support/isBuffer');

function objectToString(o) {
  return Object.prototype.toString.call(o);
}


function pad(n) {
  return n < 10 ? '0' + n.toString(10) : n.toString(10);
}


var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
              'Oct', 'Nov', 'Dec'];

// 26 Feb 16:19:34
function timestamp() {
  var d = new Date();
  var time = [pad(d.getHours()),
              pad(d.getMinutes()),
              pad(d.getSeconds())].join(':');
  return [d.getDate(), months[d.getMonth()], time].join(' ');
}


// log is just a thin wrapper to console.log that prepends a timestamp
exports.log = function() {
  console.log('%s - %s', timestamp(), exports.format.apply(exports, arguments));
};


/**
 * Inherit the prototype methods from one constructor into another.
 *
 * The Function.prototype.inherits from lang.js rewritten as a standalone
 * function (not on Function.prototype). NOTE: If this file is to be loaded
 * during bootstrapping this function needs to be rewritten using some native
 * functions as prototype setup using normal JavaScript does not work as
 * expected during bootstrapping (see mirror.js in r114903).
 *
 * @param {function} ctor Constructor function which needs to inherit the
 *     prototype.
 * @param {function} superCtor Constructor function to inherit prototype from.
 */
exports.inherits = require('inherits');

exports._extend = function(origin, add) {
  // Don't do anything if add isn't an object
  if (!add || !isObject(add)) return origin;

  var keys = Object.keys(add);
  var i = keys.length;
  while (i--) {
    origin[keys[i]] = add[keys[i]];
  }
  return origin;
};

function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

}).call(this,require("L0K7bS"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./support/isBuffer":4,"L0K7bS":3,"inherits":2}],6:[function(require,module,exports){
var EventEmitter = require('events').EventEmitter
  , inherits = require('util').inherits
  , utils = require('./utils')
  , globals = require('./globals')
  , context = new AudioContext
  , bufferSize = 4096
  , batchSize = 4
  , winSize = 4096 * 4
  , recorderBus = context.createGain()
recorderBus.connect(context.destination)
globals.recorder = new Recorder(recorderBus)

var Track = module.exports = function(audioSource) {
  EventEmitter.apply(this)
  var self = this
  this.audioSource = audioSource
  console.log('Track created, ' + this)

  this.blocksIn = []
  this.blocksOut = []

  this.stretch = 5
  this.volume = 1
  this.ampModFreq = 1
  this.ampModShape = null
  this.filterQ = 0
  this.filterFreq = 400

  this.paulstretchWorker = null
  this.paulstretchNode = null
  this.sourceNode = null
  this.ampGainNode = context.createGain()
  this.ampModulatorNode = null
  this.filterNode = context.createBiquadFilter()
  this.filterNode.type = 'bandpass'
  this.filterNode.Q.value = this.filterQ
  this.filterNode.frequency.value = this.filterFreq
  this.mixerNode = context.createGain()

  this.audioSource.addEventListener('error', function(err) {
    console.log('Load error track, ' + self)
    self.emit('load:error')
  })

  this.audioSource.addEventListener('canplay', function() {
    console.log('Can play track, ' + self)    
    var numberOfChannels = 2
    self.paulstretchWorker = new Worker('./js/paulstretch-worker.js')
    self.paulstretchNode = context.createScriptProcessor(bufferSize, numberOfChannels, numberOfChannels)

    self.paulstretchWorker.postMessage({
      type: 'init',
      winSize: winSize,
      ratio: self.stretch,
      numberOfChannels: numberOfChannels,
      blockSize: bufferSize,
      batchSize: batchSize,
    })

    self.sourceNode = context.createMediaElementSource(self.audioSource)
    self.audioSource.play()

    self.paulstretchWorker.onmessage = function (event) {
      // Add all the blocks from the batch to the `blocksOut` queue.
      if (event.data.type === 'read') {
        var blocks = event.data.data
        while (blocks.length) self.blocksOut.push(blocks.shift())
      }
    }
  
    self.paulstretchNode.onaudioprocess = function(event) {
      var ch, block = []
      // Add every incoming block to the `blocksIn` queue
      for (ch = 0; ch < numberOfChannels; ch++)
        block.push(event.inputBuffer.getChannelData(ch))
      self.blocksIn.push(block)

      // If there is any processed block, read it ...
      if (self.blocksOut.length) {
        block = self.blocksOut.shift()
        for (ch = 0; ch < numberOfChannels; ch++)
          event.outputBuffer.getChannelData(ch).set(block[ch])
      }
    }

    // Periodically, handle the `blockIn` and `blockOut` queues :
    // Send `blocksIn` to the worker for future processing and ask for batches that are ready to put in `blocksOut`.
    setInterval(function() {
      if (self.blocksIn.length)
        self.paulstretchWorker.postMessage({ type: 'write', data: self.blocksIn.shift() })

      if (self.blocksOut.length < batchSize) 
        self.paulstretchWorker.postMessage({ type: 'read' })
    }, 100)

    self.sourceNode.connect(self.paulstretchNode)
    self.paulstretchNode.connect(self.ampGainNode)
    self.ampGainNode.connect(self.filterNode)
    self.filterNode.connect(self.mixerNode)
    self.mixerNode.connect(recorderBus)

    self.emit('load:ready')
  }, true)
}
inherits(Track, EventEmitter)

Track.prototype.destroy = function() {
  if (this.ampModulatorNode) this.ampModulatorNode.stop(0) 
  this.mixerNode.disconnect()
}

Track.prototype.setStretch = function(ratio) {
  this.stretch = ratio
  this.paulstretchWorker.postMessage({ type: 'config', ratio: ratio })
}

Track.prototype.setVolume = function(volume) {
  this.volume = volume
  this.mixerNode.gain.exponentialRampToValueAtTime(volume, context.currentTime + 0.05)
}

Track.prototype.setAmpModFreq = function(freq) {
  this.ampModFreq = freq
  if (this.ampModulatorNode) {
    this.ampModulatorNode.playbackRate.exponentialRampToValueAtTime(freq, context.currentTime + 0.05)
  }
}

Track.prototype.setFilterQ = function(q) {
  this.filterQ = q
  this.filterNode.Q.linearRampToValueAtTime(q, context.currentTime + 0.05)
}

Track.prototype.setFilterFreq = function(freq) {
  this.filterFreq = freq
  this.filterNode.frequency.exponentialRampToValueAtTime(freq, context.currentTime + 0.05)
}

Track.prototype.setAmpModShape = function(array) {
  var buffer = context.createBuffer(1, 44100, context.sampleRate)
    , upsampled = utils.upsample(array, 44100)

  buffer.getChannelData(0).set(upsampled)
  this.ampModShape = array
  if (this.ampModulatorNode) {
    this.ampModulatorNode.stop(0)
    this.ampModulatorNode.disconnect()
  } else this.ampGainNode.gain.value = 0 // First time we need to remove the static gain
  this.ampModulatorNode = context.createBufferSource()
  this.ampModulatorNode.loop = true
  this.ampModulatorNode.connect(this.ampGainNode.gain)
  this.ampModulatorNode.buffer = buffer
  this.setAmpModFreq(this.ampModFreq)
  this.ampModulatorNode.start(0)
}

Track.prototype.toString = function() {
  return this.audioSource.src.slice(0, 40) + '...'
}
},{"./globals":8,"./utils":11,"events":1,"util":5}],7:[function(require,module,exports){
var EventEmitter = require('events').EventEmitter
  , globals = require('./globals')
  , inherits = require('util').inherits
  , utils = require('./utils')

var TrackView = module.exports = function(root, display) {
  EventEmitter.apply(this)

  // Setting-up the DOM
  this.root = root
  this.trackContainer = $('<div>', {class: 'track loading'}).appendTo(this.root)
  
  this.loader = $('<div>', {class: 'loader'}).appendTo(this.trackContainer)
  $('<div>', {class: 'loaderText'})
    .html('loading <button class="cancelLoad">X</button>')
    .appendTo(this.loader)

  this.errorMessage = $('<div>', {class: 'errorMessage'}).appendTo(this.trackContainer)
  $('<div>', {class: 'errorText'})
    .html('track couldn\'t load <button class="cancelLoad">X</button>')
    .appendTo(this.errorMessage)

  var self = this
    , stretchModuleContainer = $('<div>', {class: 'module'}).appendTo(this.trackContainer)
    , ampModModuleContainer = $('<div>', {class: 'module'}).appendTo(this.trackContainer)
    , filterModuleContainer = $('<div>', {class: 'module'}).appendTo(this.trackContainer)
    , gainModuleContainer = $('<div>', {class: 'module'}).appendTo(this.trackContainer)
    , trackInfosContainer = $('<div>', {class: 'module'}).appendTo(this.trackContainer)

  $('<div>', {class: 'moduleTitle'}).html('Paulstretch').appendTo(stretchModuleContainer)
  $('<div>', {class: 'moduleTitle'}).html('Amplitude modulator').appendTo(ampModModuleContainer)
  $('<div>', {class: 'moduleTitle'}).html('Bandpass').appendTo(filterModuleContainer)
  $('<div>', {class: 'moduleTitle'}).html('Gain').appendTo(gainModuleContainer)
  $('<div>', {class: 'moduleTitle trackInfos'}).html(display.slice(0, 20) + ' ...')
    .appendTo(trackInfosContainer)

  $('<button>', { class: 'deleteTrack' })
    .appendTo(trackInfosContainer)
    .html('remove track')
    .click(this.destroy.bind(this))

  $('button.cancelLoad').click(this.destroy.bind(this))


  // Creating controls
  this.stretchDial = this.makeDial(stretchModuleContainer, 'stretch', 'Ratio',
    function(val) { return 1 + utils.mapExp(val, 10) * 999 },
    function(val) { return utils.reverseMapExp((val - 1) / 999, 10) }
  )

  this.ampModShapeContainer = $('<div>', {class: 'control'}).appendTo(ampModModuleContainer)
  $('<div>', {class: 'controlTitle'}).html('Envelope').appendTo(this.ampModShapeContainer)
  this.ampModShapeMultiSlider = makeNxObject('multislider', this.ampModShapeContainer)
  this.ampModShapeMultiSlider.set([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], false)
  this.ampModShapeMultiSlider.on('value', function(array) {
    self.emit('change:ampModShape', new Float32Array(array))
  })
  this.ampModShapeMultiSlider.draw()
  $('<div>', {class: 'feedback invisible'}).html('&nbsp;').appendTo(this.ampModShapeContainer)

  this.ampModFreqDial = this.makeDial(ampModModuleContainer, 'ampModFreq', 'Frequency',
    function(val) { return utils.round(0.1 + utils.mapExp(val, 4) * 80, 1) },
    function(val) { return utils.reverseMapExp((val - 0.1) / 80, 4) }
  )

  this.filterQDial = this.makeDial(filterModuleContainer, 'filterQ', 'Q',
    function(val) { return 0.0001 + utils.mapExp(val, 6) * 100 },
    function(val) { return utils.reverseMapExp((val - 0.0001) / 100, 6) }
  )
  this.filterFreqDial = this.makeDial(filterModuleContainer, 'filterFreq', 'Frequency',
    function(val) { return 0.0001 + utils.mapExp(val, 2) * 4000 },
    function(val) { return utils.reverseMapExp((val - 0.0001) / 4000, 2) }
  )
  this.volumeDial = this.makeDial(gainModuleContainer, 'volume', 'Amount',
    function(val) { return 0.0001 + utils.mapExp(val, 2) * 4 },
    function(val) { return utils.reverseMapExp((val - 0.0001) / 4, 2) }
  )

  this.refresh()
}
inherits(TrackView, EventEmitter)

TrackView.prototype.setReady = function() {
  this.trackContainer.removeClass('loading')
}

TrackView.prototype.setError = function() {
  this.trackContainer.removeClass('loading')
  this.trackContainer.addClass('errored')
}

TrackView.prototype.destroy = function() {
  this.trackContainer.remove()
  this.emit('destroy')
}

TrackView.prototype.refresh = function() {
  this.loader.css({
    width: this.trackContainer.width(),
    height: this.trackContainer.height(),
    top: this.trackContainer.offset().top,
    left: this.trackContainer.offset().left
  })
  this.errorMessage.css({
    width: this.trackContainer.width(),
    height: this.trackContainer.height(),
    top: this.trackContainer.offset().top,
    left: this.trackContainer.offset().left
  })
}

TrackView.prototype.makeDial = function(root, paramName, controlTitle, dialToActualMap, actualToDialMap) {
  var self = this
    , container = $('<div>', {class: 'control'}).appendTo(root)
    , controlTitleElem = $('<div>', {class: 'controlTitle'}).html(controlTitle).appendTo(container)
    , dial = makeNxObject('dial', container)
    , feedbackElem = $('<div>', {class: 'feedback'}).appendTo(container)

  dial.on('value', function(val) {
    val = dialToActualMap(val)
    self.emit('change:' + paramName, val)
    $(feedbackElem).html(getDisplay(val))
  })

  this['set' + paramName.charAt(0).toUpperCase() + paramName.slice(1)] = function(val) {
    dial.set({value: actualToDialMap(val)}, false)
    $(feedbackElem).html(getDisplay(val))
  }
  return dial
}

var makeNxObject = function(nxType, container) {
  var canvas = $('<canvas>').attr({
    'width': globals.width / 13,
    'height': globals.width / 13,
    'nx': nxType
  }).appendTo(container)
  return nx.createNxObject(canvas.get(0))
}

var getDisplay = function(val) {
  var display = ('' + utils.round(val, 2)).split('.')
  if (display.length === 2) display[1] = display[1].slice(0, 2)
  return display.join('.')
}
},{"./globals":8,"./utils":11,"events":1,"util":5}],8:[function(require,module,exports){
exports.appWidth = null
exports.fsToken = '9c285499c27fdb0322da949ef05d5189a09dd4e4'
exports.scToken = 'c9c439eb2401e825566ba09d71abe007'
},{}],9:[function(require,module,exports){
$(function() {

  var hideModal = function() {
    $('.modal').fadeOut()
    $('#modalOverlay').fadeOut()    
  }

  var showModal = function(selector) {
    $('.modal').hide()
    $(selector).fadeIn()
    $('#modalOverlay').fadeIn()
  }

  $('#modalOverlay').click(hideModal.bind(this))
  $('#showAbout').click(showModal.bind(this, '#aboutModal'))
  
  // Feature and browser detection
  var ffResult, ffVersion
  if (!window.AudioContext) {
    showModal('#noWebAudioAPIError')
    $('#createTrack').hide()
    $('#recContainer').hide()
    return 
  } else if (ffResult = /firefox\/([0-9]+)/.exec(navigator.userAgent.toLowerCase())) {
    ffVersion = parseInt(ffResult[1])
    if (ffVersion < 37) {
      showModal('#firefoxError')
      $('#createTrack').hide()
      $('#recContainer').hide()
      return
    }
  }

  // Initializing the app
  var globals = require('./globals')
    , Track = require('./Track')
    , TrackView = require('./TrackView')
    , soundSources = require('./soundSources')

  nx.colorize('#009ee0')
  nx.colorize('border', '#272727')
  nx.colorize('fill', '#272727')

  globals.width = $(window).width()
  var trackViewsContainer = $('#trackViews')
    , tracks = []
    , maxTracks = 6

  var createTrack = function(url, display) {
    var audioSource = new Audio()
      , track
    audioSource.crossOrigin = 'anonymous'
    audioSource.src = url
    track = {
      model: new Track(audioSource),
      view: trackView = new TrackView(trackViewsContainer, display)
    }

    tracks.push(track)

    track.view.on('destroy', function() {
      track.view.removeAllListeners()
      track.model.destroy()
      tracks.splice(tracks.indexOf(track), 1)
      tracks.forEach(function(t) { t.view.refresh() })
    })

    track.view.on('change:stretch', track.model.setStretch.bind(track.model))
    track.view.setStretch(track.model.stretch)

    track.view.on('change:volume', track.model.setVolume.bind(track.model))
    track.view.setVolume(track.model.volume)

    track.view.on('change:ampModFreq', track.model.setAmpModFreq.bind(track.model))
    track.view.setAmpModFreq(track.model.ampModFreq)

    track.view.on('change:filterQ', track.model.setFilterQ.bind(track.model))
    track.view.setFilterQ(track.model.filterQ)

    track.view.on('change:filterFreq', track.model.setFilterFreq.bind(track.model))
    track.view.setFilterFreq(track.model.filterFreq)

    track.view.on('change:ampModShape', track.model.setAmpModShape.bind(track.model))

    track.model.on('load:ready', track.view.setReady.bind(track.view))
    track.model.on('load:error', track.view.setError.bind(track.view))
  }


  $('#createTrack').click(function() {
    if (tracks.length < maxTracks) showModal('#soundSourcesModal')
    else showModal('#maxTracksReachedModal')
  })


  soundSources.emitter.on('selected', function(r) {
    createTrack(r.url, r.display)
    hideModal('#soundSourcesModal')
  })

  new soundSources.SoundCloudSourceView($('#soundCloudSource'))
  SC.initialize({ client_id: globals.scToken })
  //new soundSources.FreeSoundSourceView($('#freesoundSource'))

  $('#toggleRec').click(function() {
    var button = $(this)
    if (!button.hasClass('recording')) {
      globals.recorder.record()
      button.html('Recording...')
      button.addClass('recording')
    } else {
      globals.recorder.stop()
      button.html('Record')
      button.removeClass('recording')
      createDownload()
      globals.recorder.clear()
    }
  })

  var createDownload = function() {
    globals.recorder.exportWAV(function(blob) {
      var url = URL.createObjectURL(blob)
      var hf = $('<a>', {
        href: url,
        class: 'downloadRec',
        download: new Date().toISOString() + '.wav'
      }).html($('#recContainer .downloadRec').length + 1).appendTo('#recContainer')
    })
  }

})

},{"./Track":6,"./TrackView":7,"./globals":8,"./soundSources":10}],10:[function(require,module,exports){
var EventEmitter = require('events').EventEmitter
  , inherits = require('util').inherits
  , globals = require('./globals')

exports.emitter = new EventEmitter()

var SoundSourceView = function(root) {
  SoundSourceView.all.push(this)
  var self = this
    , searchResultsUl = root.find('ul.searchResults')
  this.root = root

  this.root.find('form').submit(function(event) {
    event.preventDefault()
    root.addClass('searching')
    self.search(root.find('input[type=text]').val(), function(results) {
      root.removeClass('searching')
      searchResultsUl.empty()
      results.forEach(function(r) {
        $('<li>', { class: 'searchResult' }).html(r.display).appendTo(searchResultsUl)
          .click(self.resultClicked.bind(self, r))
      })
    })
  })
}

SoundSourceView.prototype.search = function(q, done) {}
SoundSourceView.prototype.resultClicked = function() {}
SoundSourceView.all = []

// SoundCloud source 
var SoundCloudSourceView = module.exports.SoundCloudSourceView = function(root) {
  SoundSourceView.apply(this, arguments)
}
inherits(SoundCloudSourceView, SoundSourceView)

SoundCloudSourceView.prototype.search = function(q, done) {
  SC.get('/tracks', {limit: 10, q: q}, function(results) {
    done(results.map(function(r) {
      return {
        display: r.user.username + ' - ' + r.title,
        url: r.stream_url + '?client_id=' + globals.scToken
      }
    }))
  })
}

SoundCloudSourceView.prototype.resultClicked = function(result) {
  exports.emitter.emit('selected', result)
} 

// freesound.org source
var FreeSoundSourceView = module.exports.FreeSoundSourceView = function(root) {
  SoundSourceView.apply(this, arguments)
}
inherits(FreeSoundSourceView, SoundSourceView)

FreeSoundSourceView.prototype.search = function(q, done) {
  var url = 'http://freesound.org/apiv2/search/text/?token=' + globals.fsToken + '&query=' + q
  $.getJSON(url, function(results) {
    done(results.results.map(function(r) {
      return {
        display: r.username + ' - ' + r.name,
        url: 'http://freesound.org/apiv2/sounds/' + r.id + '/?token=' + globals.fsToken
      }
    }))
  })
}

FreeSoundSourceView.prototype.resultClicked = function(result) {
  $.getJSON(result.url, function(r) {
    exports.emitter.emit('selected', r.download + '?token=' + globals.fsToken, result.display)
  })
}
},{"./globals":8,"events":1,"util":5}],11:[function(require,module,exports){
exports.mapExp = function(x, a) {
  return (Math.exp(x * a) - Math.exp(0)) / (Math.exp(a) - Math.exp(0))
}

exports.reverseMapExp = function(x, a) {
  return Math.log(x * (Math.exp(a) - Math.exp(0)) + Math.exp(0)) / a
}

exports.upsample = function(y, numPoints) {
  var m, b
    , x, interpX, interpXStep = (y.length - 1) / (numPoints - 1), i
    , interpY = new Float32Array(numPoints)

  i = 0
  interpX = 0
  for (x = 0; x < y.length - 1; x++) {
    m = (y[x + 1] - y[x])
    b = y[x] - m * x
    
    while (interpX <= x + 1) {
      interpY[i++] = m * interpX + b
      interpX += interpXStep
    }
  }

  return interpY
}

exports.round = function(val, decimal) {
  return Math.round(val * Math.pow(10, decimal)) / Math.pow(10, decimal)
}
},{}]},{},[9])