var EventEmitter = require('events').EventEmitter
var utils = require('./utils')
var globals = require('./globals')
var bufferSize = 4096
var batchSize = 4
var winSize = 4096 * 4
var context = null
var recorderBus

class Track extends EventEmitter {
    
    constructor(audioSource) {
        super()
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
        
        this.audioSource.addEventListener('error', this._onAudioSourceError.bind(this))
        this.audioSource.addEventListener('canplay', this._onAudioSourceCanPlay.bind(this), true)
    }
    
    destroy() {
        if (this.ampModulatorNode) this.ampModulatorNode.stop(0) 
        this.mixerNode.disconnect()
    }
    
    setStretch(ratio) {
        this.stretch = ratio
        this.paulstretchWorker.postMessage({ type: 'config', ratio: ratio })
    }
    
    setVolume(volume) {
        this.volume = volume
        this.mixerNode.gain.exponentialRampToValueAtTime(volume, context.currentTime + 0.05)
    }
    
    setFilterQ(q) {
        this.filterQ = q
        this.filterNode.Q.linearRampToValueAtTime(q, context.currentTime + 0.05)
    }
    
    setFilterFreq(freq) {
        this.filterFreq = freq
        this.filterNode.frequency.exponentialRampToValueAtTime(freq, context.currentTime + 0.05)
    }
    
    setAmpModFreq(freq) {
        this.ampModFreq = freq
        if (this.ampModulatorNode) {
            this.ampModulatorNode.playbackRate.exponentialRampToValueAtTime(freq, context.currentTime + 0.05)
        }
    }

    setAmpModShape(array) {
        var buffer = context.createBuffer(1, 44100, context.sampleRate)
        var upsampled = utils.upsample(array, 44100)
        
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
    
    toString() {
        return this.audioSource.src.slice(0, 40) + '...'
    }

    _onAudioSourceError(err) {
        console.log('Load error track, ' + this)
        this.emit('load:error')
    }

    _onAudioSourceCanPlay() {
        console.log('Can play track, ' + this)    
        var numberOfChannels = 2
        this.paulstretchWorker = new Worker('./js/paulstretch-worker.js')
        this.paulstretchNode = context.createScriptProcessor(bufferSize, numberOfChannels, numberOfChannels)
        
        this.paulstretchWorker.postMessage({
            type: 'init',
            winSize: winSize,
            ratio: this.stretch,
            numberOfChannels: numberOfChannels,
            blockSize: bufferSize,
            batchSize: batchSize,
        })
        
        this.sourceNode = context.createMediaElementSource(this.audioSource)
        this.audioSource.play()
        
        this.paulstretchWorker.onmessage = (event) => {
            // Add all the blocks from the batch to the `blocksOut` queue.
            if (event.data.type === 'read') {
                var blocks = event.data.data
                while (blocks.length) this.blocksOut.push(blocks.shift())
            }
        }
        
        this.paulstretchNode.onaudioprocess = (event) => {
            var ch, block = []
            // Add every incoming block to the `blocksIn` queue
            for (ch = 0; ch < numberOfChannels; ch++)
            block.push(event.inputBuffer.getChannelData(ch))
            this.blocksIn.push(block)
            
            // If there is any processed block, read it ...
            if (this.blocksOut.length) {
                block = this.blocksOut.shift()
                for (ch = 0; ch < numberOfChannels; ch++)
                event.outputBuffer.getChannelData(ch).set(block[ch])
            }
        }
        
        // Periodically, handle the `blockIn` and `blockOut` queues :
        // Send `blocksIn` to the worker for future processing and ask for batches that are ready to put in `blocksOut`.
        setInterval(() => {
            if (this.blocksIn.length)
            this.paulstretchWorker.postMessage({ type: 'write', data: this.blocksIn.shift() })
            
            if (this.blocksOut.length < batchSize) 
            this.paulstretchWorker.postMessage({ type: 'read' })
        }, 100)
        
        this.sourceNode.connect(this.paulstretchNode)
        this.paulstretchNode.connect(this.ampGainNode)
        this.ampGainNode.connect(this.filterNode)
        this.filterNode.connect(this.mixerNode)
        this.mixerNode.connect(recorderBus)
        
        this.emit('load:ready')
    }

}

Track.ensureAudioContext = () => {
    if (!context) {
        console.log('creating audio context')
        context = new AudioContext
        recorderBus = context.createGain()
        recorderBus.connect(context.destination)
        globals.recorder = new Recorder(recorderBus)        
    }
}

module.exports = Track