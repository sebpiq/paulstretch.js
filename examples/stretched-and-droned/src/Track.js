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