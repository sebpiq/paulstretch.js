(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var PaulStretch = require('./lib/PaulStretch')

module.exports.PaulStretch = PaulStretch

if (typeof self !== 'undefined') self.PaulStretch = PaulStretch
if (typeof window !== 'undefined') window.PaulStretch = PaulStretch
},{"./lib/PaulStretch":2}],2:[function(require,module,exports){
// paulstretch.js
// Copyright (C) 2014 Sébastien Piquemal
// Copyright (C) 2006-2011 Nasca Octavian Paul

var utils = require('./utils')
  , blockHelpers = require('./block-helpers')
  , arrayHelpers = require('./array-helpers')


var PaulStretch = module.exports = function(numberOfChannels, ratio, winSize) {

  this.winSize = winSize = winSize || 4096
  var halfWinSize = winSize / 2
    , samplesIn = new utils.Samples()
    , samplesOut = new utils.Samples()

  // Sets the stretch ratio. Note that blocks that have already been processed are using the old ratio.
  this.setRatio = function(val) {
    ratio = val
    samplesIn.setDisplacePos((winSize * 0.5) / ratio)
  }
  this.setRatio(ratio)

  // Returns the number of frames waiting to be processed
  this.writeQueueLength = function() { return samplesIn.getFramesAvailable() }

  // Returns the number of frames already processed
  this.readQueueLength = function() { return samplesOut.getFramesAvailable() }

  // Reads processed samples to `block`. Returns `block`, or `null` if there wasn't enough processed frames.
  this.read = function(block) {
    return samplesOut.read(block)
  }

  // Pushes `block` to the processing queue. Beware! The block is not copied, so make sure not to modify it afterwards. 
  this.write = function(block) {
    samplesIn.write(block)
  }

  // Process samples from the queue. Returns the number of processed frames that were generated 
  this.process = (function() {
    var blockIn = blockHelpers.newBlock(numberOfChannels, winSize)
      , blockOut = blockHelpers.newBlock(numberOfChannels, winSize)
      , winArray = utils.createWindow(winSize)
      , phaseArray = new Float32Array(halfWinSize + 1)
      , rephase = utils.makeRephaser(winSize)

    return function() {
      // Read a block to blockIn
      if (samplesIn.read(blockIn) === null) return 0
      
      // get the windowed buffer
      utils.applyWindow(blockIn, winArray)

      // Randomize phases for each channel
      for (ch = 0; ch < numberOfChannels; ch++) {
        arrayHelpers.map(phaseArray, function() { return Math.random() * 2 * Math.PI })
        rephase(blockIn[ch], phaseArray)
      }

      // overlap-add the output
      utils.applyWindow(blockIn, winArray)

      for (ch = 0; ch < numberOfChannels; ch++) {
        arrayHelpers.add(
          blockIn[ch].subarray(0, halfWinSize),
          blockOut[ch].subarray(halfWinSize, winSize)
        )
      }

      // Generate the output
      blockOut = blockIn.map(function(chArray) { return arrayHelpers.duplicate(chArray) })
      samplesOut.write(blockOut.map(function(chArray) { return chArray.subarray(0, halfWinSize) }))
      return halfWinSize
    }

  })()

  this.toString = function() {
    return 'PaulStretch(' + numberOfChannels + 'X' + this.winSize + ')'
  }

}
},{"./array-helpers":3,"./block-helpers":4,"./utils":5}],3:[function(require,module,exports){
var add = module.exports.add = function(array1, array2) {
  var i, length = array1.length
  for (i = 0; i < length; i++)
    array1[i] += array2[i]
  return array1
}

var map = module.exports.map = function(array, func) {
  var i, length
  for (i = 0, length = array.length; i < length; i++) array[i] = func(array[i])
  return array
}

var duplicate = module.exports.duplicate = function(array) {
  return copy(array, new Float32Array(array.length))
}

var copy = module.exports.copy = function(array1, array2) {
  var i, length
  for (i = 0, length = array1.length; i < length; i++) array2[i] = array1[i]
  return array2
}
},{}],4:[function(require,module,exports){
var newBlock = module.exports.newBlock = function(numberOfChannels, blockSize) {
  var block = [], ch
  for (ch = 0; ch < numberOfChannels; ch++)
    block.push(new Float32Array(blockSize))
  return block
}
},{}],5:[function(require,module,exports){
var fft = require('ndfft')
  , arrayHelpers = require('./array-helpers')


module.exports.createWindow = function(winSize) {
  var winArray = new Float32Array(winSize)
    , counter = -1, step = 2/(winSize - 1)
  for (i = 0; i < winSize; i++) {
    winArray[i] = Math.pow(1 - Math.pow(counter, 2), 1.25)
    counter += step
  }
  return winArray
}

module.exports.applyWindow = function(block, winArray) {
  var frameCount = block[0].length
    , channelCount = block.length
    , ch, i
  
  for (i = 0; i < frameCount; i++) {
    for (ch = 0; ch < channelCount; ch++)
      block[ch][i] = block[ch][i] * winArray[i]
  }
}

// Returns a function for setting the phases of an array, array length `winSize`.
// The returned function is `rephase(array, phases)`. 
module.exports.makeRephaser = function(winSize) {
  var symSpectrumSlice = [1, winSize / 2]
    , uniqSpectrumSlice = [0, winSize / 2 + 1]
    , re = [].slice.call(new Float32Array(winSize), 0) // Don't know why the FFT not working with typed arrays
    , im = [].slice.call(new Float32Array(winSize), 0)
    , amplitudes = new Float32Array(uniqSpectrumSlice[1])
    , i, length

  return function(array, phases) {
    // Prepare im and re for FFT
    arrayHelpers.map(im, function() { return 0 })
    arrayHelpers.copy(array, re)

    // get the amplitudes of the frequency components and discard the phases
    fft(1, re, im)
    arrayHelpers.copy(re.slice.apply(re, uniqSpectrumSlice), amplitudes) // get only the unique part of the spectrum
    arrayHelpers.map(amplitudes, Math.abs) // input signal is real, so abs value of `re` is the amplitude

    // Apply the new phases
    for (i = 0, length = amplitudes.length; i < length; i++) {
      re[i] = amplitudes[i] * Math.cos(phases[i])
      im[i] = amplitudes[i] * Math.sin(phases[i])
    }

    // Rebuild `re` and `im` by adding the symetric part
    for (i = symSpectrumSlice[0], length = symSpectrumSlice[1]; i < length; i++) {
      re[length + i] = re[length - i]
      im[length + i] = im[length - i] * -1
    }

    // do the inverse FFT
    fft(-1, re, im)
    arrayHelpers.copy(re, array)
    return array
  }
}

// Buffer of blocks allowing to read blocks of a fixed block size and to get overlapped
// blocks in output.
// `samples.write(block)` will queue `block`
// `samples.read(blockOut)` will read the queued blocks to `blockOut`
module.exports.Samples = function(displacePos) {
  var blocksIn = []
    , readPos = 0, framesAvailable = 0

  this.setDisplacePos = function(val) { displacePos = val }
  this.getReadPos = function() { return readPos }
  this.getFramesAvailable = function() { return framesAvailable }

  // If there's more data than `blockSize` return a block, otherwise return null.
  this.read = function(blockOut) {
    var numberOfChannels = blockOut.length
      , blockSize = blockOut[0].length
      , i, ch, block
      , writePos  // position of writing in output block
      , readStart // position to start reading from the next block
      , toRead    // amount of frames to read from the next block

    if (framesAvailable >= blockSize) {
      readStart = Math.floor(readPos)
      writePos = 0
      i = 0

      // Write inBlocks to the outBlock
      while(writePos < blockSize) {
        block = blocksIn[i++]
        toRead = Math.min(block[0].length - readStart, blockSize - writePos)

        for (ch = 0; ch < numberOfChannels; ch++)
          blockOut[ch].set(block[ch].subarray(readStart, readStart + toRead), writePos)
        writePos += toRead
        readStart = 0
      }

      // Update positions
      readPos += (displacePos || blockSize)
      framesAvailable -= (displacePos || blockSize)

      // Discard used input blocks
      block = blocksIn[0]
      while (block[0].length < readPos) {
        blocksIn.shift()
        readPos -= block[0].length
        block = blocksIn[0]
      }

      return blockOut
    } else return null
  }

  // Writes `block` to the queue
  this.write = function(block) {
    blocksIn.push(block)
    framesAvailable += block[0].length
  }

}
},{"./array-helpers":3,"ndfft":6}],6:[function(require,module,exports){
"use strict";

var bits = require("bit-twiddle");

//Cached buffers
var x0 = new Float64Array(4096);
var y0 = new Float64Array(4096);
function realloc(n) {
  if(x0.length < n) {
    x0 = new Float64Array(n);
    y0 = new Float64Array(n);
  }
}

//In place 1D FFT
function fft(dir,m,x,y) {
  var nn,i,i1,j,k,i2,l,l1,l2;
  var c1,c2,tx,ty,t1,t2,u1,u2,z;
  
  /* Calculate the number of points */
  nn = 1<<m;
  
  /* Do the bit reversal */
  i2 = nn >> 1;
  j = 0;
  for (i=0;i<nn-1;i++) {
    if (i < j) {
      tx = x[i];
      ty = y[i];
      x[i] = x[j];
      y[i] = y[j];
      x[j] = tx;
      y[j] = ty;
    }
    k = i2;
    while (k <= j) {
      j -= k;
      k >>= 1;
    }
    j += k;
  }
  
  /* Compute the FFT */
  c1 = -1.0;
  c2 = 0.0;
  l2 = 1;
  for (l=0;l<m;l++) {
    l1 = l2;
    l2 <<= 1;
    u1 = 1.0;
    u2 = 0.0;
    for (j=0;j<l1;j++) {
      for (i=j;i<nn;i+=l2) {
        i1 = i + l1;
        t1 = u1 * x[i1] - u2 * y[i1];
        t2 = u1 * y[i1] + u2 * x[i1];
        x[i1] = x[i] - t1;
        y[i1] = y[i] - t2;
        x[i] += t1;
        y[i] += t2;
      }
      z =  u1 * c1 - u2 * c2;
      u2 = u1 * c2 + u2 * c1;
      u1 = z;
    }
    c2 = Math.sqrt((1.0 - c1) / 2.0);
    if (dir === 1)
      c2 = -c2;
    c1 = Math.sqrt((1.0 + c1) / 2.0);
  }
  
  /* Scaling for forward transform */
  if (dir == -1) {
    var scale_f = 1.0 / nn;
    for (i=0;i<nn;i++) {
      x[i] *= scale_f;
      y[i] *= scale_f;
    }
  }
}

//In place 2D fft
function fft2(dir, m, n, x, y) {
  realloc(x.length);
  for(var i=0; i<x.length; ++i) {
    fft(dir, m, x[i], y[i]);
  }
  for(var j=0; j<x[0].length; ++j) {
    for(var i=0; i<x.length; ++i) {
      x0[i] = x[i][j];
      y0[i] = y[i][j];
    }
    fft(dir, n, x0, y0);
    for(var i=0; i<x.length; ++i) {
      x[i][j] = x0[i];
      y[i][j] = y0[i];
    }
  }
}

//In place 3D fft
function fft3(dir, m, n, p, x, y) {
  realloc(Math.max(x.length, x[0].length));
  for(var i=0; i<x.length; ++i) {
    var rx = x[i];
    var ry = y[i];
    for(var j=0; j<rx.length; ++j) {
      fft(dir, m, rx[j], ry[j]);
    }
    for(var j=0; j<rx[0].length; ++j) {
      for(var k=0; k<rx.length; ++k) {
        x0[k] = rx[k][j];
        y0[k] = ry[k][j];
      }
      fft(dir, n, x0, y0);
      for(var k=0; k<rx.length; ++k) {
        rx[k][j] = x0[k];
        ry[k][j] = y0[k];
      }
    }
  }
  for(var i=0; i<x[0].length; ++i) {
    for(var j=0; j<x[0][0].length; ++j) {
      for(var k=0; k<x.length; ++k) {
        x0[k] = x[k][i][j];
        y0[k] = y[k][i][j];
      }
      fft(dir, p, x0, y0);
      for(var k=0; k<x.length; ++k) {
        x[k][i][j] = x0[k];
        y[k][i][j] = y0[k];
      }
    }
  }
}


function get_item(x, coord, n) {
  if(n === 1) {
    return x[coord[0]];
  }
  return get_item(x[coord[n-1]], coord, n-1);
}

function set_item(x, coord, n, v) {
  if(n === 1) {
    x[coord[0]] = v;
    return;
  }
  set_item(x[coord[n-1]], coord, n-1, v);
}

//Slow sweeping algorithm
function fft_sweep(dir, n, coord, x, y) {
  if(n < coord.length-1) {
    for(var i=0; i<x[n].length; ++i) {
      coord[n] = i;
      fft_sweep(dir, n+1, coord, x, y);
    }
    return;
  }
  for(var i=0; i<x.length; ++i) {
    coord[n] = i;
    x0[i] = get_item(x, coord, coord.length);
    y0[i] = get_item(y, coord, coord.length);
  }
  fft(dir, bits.log2(x.length), x0, y0);
  for(var i=0; i<x.length; ++i) {
    coord[n] = i;
    set_item(x, coord, coord.length, x0[i]);
    set_item(y, coord, coord.length, y0[i]);
  }
}

//Compute dimension of tensor
function dimension(x) {
  var d = 0;
  while(x instanceof Array) {
    ++d;
    x = x[0];
  }
  return d;
}

//In place n-dimensional fft
function fftn(dir, x, y) {
  //First, handle easy cases
  var n = dimension(x);
  switch(n) {
    case 0:
      return;
    case 1:
      return fft(dir, bits.log2(x.length), x, y);
    case 2:
      return fft2(dir, bits.log2(x[0].length), bits.log2(x.length), x, y);
    case 3:
      return fft3(dir, bits.log2(x[0][0].length), bits.log2(x[0].length), bits.log2(x.length), x, y);
    default:
    break;
  }
  //Slow/unusual case: Handle higher dimensions
  for(var i=0; i<x.length; ++i) {
    fftn(dir, x[i], y[i]);
  }
  realloc(x.length);
  fft_sweep(dir, 0, new Array(n), x, y);
}

module.exports = fftn;

},{"bit-twiddle":7}],7:[function(require,module,exports){
/**
 * Bit twiddling hacks for JavaScript.
 *
 * Author: Mikola Lysenko
 *
 * Ported from Stanford bit twiddling hack library:
 *    http://graphics.stanford.edu/~seander/bithacks.html
 */

"use strict"; "use restrict";

//Number of bits in an integer
var INT_BITS = 32;

//Constants
exports.INT_BITS  = INT_BITS;
exports.INT_MAX   =  0x7fffffff;
exports.INT_MIN   = -1<<(INT_BITS-1);

//Returns -1, 0, +1 depending on sign of x
exports.sign = function(v) {
  return (v > 0) - (v < 0);
}

//Computes absolute value of integer
exports.abs = function(v) {
  var mask = v >> (INT_BITS-1);
  return (v ^ mask) - mask;
}

//Computes minimum of integers x and y
exports.min = function(x, y) {
  return y ^ ((x ^ y) & -(x < y));
}

//Computes maximum of integers x and y
exports.max = function(x, y) {
  return x ^ ((x ^ y) & -(x < y));
}

//Checks if a number is a power of two
exports.isPow2 = function(v) {
  return !(v & (v-1)) && (!!v);
}

//Computes log base 2 of v
exports.log2 = function(v) {
  var r, shift;
  r =     (v > 0xFFFF) << 4; v >>>= r;
  shift = (v > 0xFF  ) << 3; v >>>= shift; r |= shift;
  shift = (v > 0xF   ) << 2; v >>>= shift; r |= shift;
  shift = (v > 0x3   ) << 1; v >>>= shift; r |= shift;
  return r | (v >> 1);
}

//Computes log base 10 of v
exports.log10 = function(v) {
  return  (v >= 1000000000) ? 9 : (v >= 100000000) ? 8 : (v >= 10000000) ? 7 :
          (v >= 1000000) ? 6 : (v >= 100000) ? 5 : (v >= 10000) ? 4 :
          (v >= 1000) ? 3 : (v >= 100) ? 2 : (v >= 10) ? 1 : 0;
}

//Counts number of bits
exports.popCount = function(v) {
  v = v - ((v >>> 1) & 0x55555555);
  v = (v & 0x33333333) + ((v >>> 2) & 0x33333333);
  return ((v + (v >>> 4) & 0xF0F0F0F) * 0x1010101) >>> 24;
}

//Counts number of trailing zeros
function countTrailingZeros(v) {
  var c = 32;
  v &= -v;
  if (v) c--;
  if (v & 0x0000FFFF) c -= 16;
  if (v & 0x00FF00FF) c -= 8;
  if (v & 0x0F0F0F0F) c -= 4;
  if (v & 0x33333333) c -= 2;
  if (v & 0x55555555) c -= 1;
  return c;
}
exports.countTrailingZeros = countTrailingZeros;

//Rounds to next power of 2
exports.nextPow2 = function(v) {
  v += v === 0;
  --v;
  v |= v >>> 1;
  v |= v >>> 2;
  v |= v >>> 4;
  v |= v >>> 8;
  v |= v >>> 16;
  return v + 1;
}

//Rounds down to previous power of 2
exports.prevPow2 = function(v) {
  v |= v >>> 1;
  v |= v >>> 2;
  v |= v >>> 4;
  v |= v >>> 8;
  v |= v >>> 16;
  return v - (v>>>1);
}

//Computes parity of word
exports.parity = function(v) {
  v ^= v >>> 16;
  v ^= v >>> 8;
  v ^= v >>> 4;
  v &= 0xf;
  return (0x6996 >>> v) & 1;
}

var REVERSE_TABLE = new Array(256);

(function(tab) {
  for(var i=0; i<256; ++i) {
    var v = i, r = i, s = 7;
    for (v >>>= 1; v; v >>>= 1) {
      r <<= 1;
      r |= v & 1;
      --s;
    }
    tab[i] = (r << s) & 0xff;
  }
})(REVERSE_TABLE);

//Reverse bits in a 32 bit word
exports.reverse = function(v) {
  return  (REVERSE_TABLE[ v         & 0xff] << 24) |
          (REVERSE_TABLE[(v >>> 8)  & 0xff] << 16) |
          (REVERSE_TABLE[(v >>> 16) & 0xff] << 8)  |
           REVERSE_TABLE[(v >>> 24) & 0xff];
}

//Interleave bits of 2 coordinates with 16 bits.  Useful for fast quadtree codes
exports.interleave2 = function(x, y) {
  x &= 0xFFFF;
  x = (x | (x << 8)) & 0x00FF00FF;
  x = (x | (x << 4)) & 0x0F0F0F0F;
  x = (x | (x << 2)) & 0x33333333;
  x = (x | (x << 1)) & 0x55555555;

  y &= 0xFFFF;
  y = (y | (y << 8)) & 0x00FF00FF;
  y = (y | (y << 4)) & 0x0F0F0F0F;
  y = (y | (y << 2)) & 0x33333333;
  y = (y | (y << 1)) & 0x55555555;

  return x | (y << 1);
}

//Extracts the nth interleaved component
exports.deinterleave2 = function(v, n) {
  v = (v >>> n) & 0x55555555;
  v = (v | (v >>> 1))  & 0x33333333;
  v = (v | (v >>> 2))  & 0x0F0F0F0F;
  v = (v | (v >>> 4))  & 0x00FF00FF;
  v = (v | (v >>> 16)) & 0x000FFFF;
  return (v << 16) >> 16;
}


//Interleave bits of 3 coordinates, each with 10 bits.  Useful for fast octree codes
exports.interleave3 = function(x, y, z) {
  x &= 0x3FF;
  x  = (x | (x<<16)) & 4278190335;
  x  = (x | (x<<8))  & 251719695;
  x  = (x | (x<<4))  & 3272356035;
  x  = (x | (x<<2))  & 1227133513;

  y &= 0x3FF;
  y  = (y | (y<<16)) & 4278190335;
  y  = (y | (y<<8))  & 251719695;
  y  = (y | (y<<4))  & 3272356035;
  y  = (y | (y<<2))  & 1227133513;
  x |= (y << 1);
  
  z &= 0x3FF;
  z  = (z | (z<<16)) & 4278190335;
  z  = (z | (z<<8))  & 251719695;
  z  = (z | (z<<4))  & 3272356035;
  z  = (z | (z<<2))  & 1227133513;
  
  return x | (z << 2);
}

//Extracts nth interleaved component of a 3-tuple
exports.deinterleave3 = function(v, n) {
  v = (v >>> n)       & 1227133513;
  v = (v | (v>>>2))   & 3272356035;
  v = (v | (v>>>4))   & 251719695;
  v = (v | (v>>>8))   & 4278190335;
  v = (v | (v>>>16))  & 0x3FF;
  return (v<<22)>>22;
}

//Computes next combination in colexicographic order (this is mistakenly called nextPermutation on the bit twiddling hacks page)
exports.nextCombination = function(v) {
  var t = v | (v - 1);
  return (t + 1) | (((~t & -~t) - 1) >>> (countTrailingZeros(v) + 1));
}


},{}]},{},[1])