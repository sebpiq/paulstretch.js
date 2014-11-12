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