// importScripts('paulstretch.js')

var debugActivated = true

class PaulStretchNode extends AudioWorkletProcessor {

    constructor(options) {
        super(options)

        this.blocksOut = []
        this.blocksIn = []
        this.numberOfChannels = options.outputChannelCount

        // // Initializing the paulstretch object
        // this.paulStretch = new PaulStretch(
        //     this.numberOfChannels, 
        //     options.processorOptions.ratio, 
        //     options.processorOptions.winSize,
        // )
        
        // // Initializing other settings
        // this.batchSize = options.processorOptions.batchSize
        // this.blockSize = options.processorOptions.blockSize
        
        // // Initializing `blockOuts` to contain several blocks (i.e arrays of Float32Array)
        // // That we are going to reuse to avoid allocations.
        // for (var i = 0; i < this.batchSize; i++) {
        //     this.blocksOut.unshift([])
        //     for (var ch = 0; ch < this.numberOfChannels; ch++) {
        //         this.blocksOut[0].push(new Float32Array(this.blockSize))
        //     }
        // }
        // 
        // debug('initialized ' + paulStretch.toString())
    }

    static get parameterDescriptors () {
        return [
            { name: 'ratio', defaultValue: 5 }
        ];
    }
    
    process (inputs, outputs, parameters) {
        const input = inputs[0]
        const output = outputs[0]

        output.forEach(channel => {
          for (let i = 0; i < channel.length; i++) {
            channel[i] = Math.random() * 2 - 1
          }
        })
        return true

        // // Add every incoming block to the `blocksIn` queue
        // this.blocksIn.push(input.slice(0))
        
        // // If there is any processed block, read it ...
        // var ch, block = []
        // if (this.blocksOut.length) {
        //     block = this.blocksOut.shift()
        //     for (ch = 0; ch < numberOfChannels; ch++)
        //         output[ch].set(block[ch])
        // }

        // setTimeout(this.processPaulStretch, 0)
    }

    processPaulStretch = () => {
        var i, numberOfBlocksReady
        // Process until we have more than `batchSize` blocks,
        // or until we don't have enough frames to process. 
        while (
            (this.paulStretch.readQueueLength() < this.batchSize * this.blockSize) 
            && this.paulStretch.process() !== 0
        ) {
            this.paulStretch.readQueueLength()
        }
        
        // Reads at most `batchSize` blocks from paulstretch output
        numberOfBlocksReady = Math.min(
            Math.floor(this.paulStretch.readQueueLength() / this.blockSize),
            this.batchSize,
        )
        if (numberOfBlocksReady === 0) {
            debug('process starved')
        }
        debug('GOT ' + numberOfBlocksReady + ' BLOOOOOOKCS')
    
        for (i = 0; i < numberOfBlocksReady; i++) {
            this.paulStretch.read(this.blocksOut[i])
        }
    }

}

registerProcessor('PaulStretchNode', PaulStretchNode);


var debug = function(msg) {
    if (debugActivated) console.log(msg)
}