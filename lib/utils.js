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