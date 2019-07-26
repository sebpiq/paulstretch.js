var fs = require('fs')
var pcm = require('pcm-boilerplate')
var blockHelpers = require('../lib/block-helpers')
var PaulStretch = require('../lib/PaulStretch')

describe('PaulStretch', function() {
    
    describe('process', function() {
        
        it('should stretch a mono file of miles', function(done) {
            var format = {bitDepth: 16, numberOfChannels: 1, sampleRate: 44100}
            var decoder = pcm.BufferDecoder(format)
            var encoder = pcm.BufferEncoder(format)
            var blockIn, blockOut
            var samples, readPos = 0, paulstretch
            
            fs.readFile(__dirname + '/sounds/miles-mono.raw', function(err, dataIn) {
                if (err) throw err
                
                // Extract the samples from the file
                samples = decoder(dataIn)
                
                var nextFileSamples = function() {
                    if ((samples[0].length - readPos) > 256) {
                        readPos += 256
                        return [samples[0].subarray(readPos - 256, readPos)]
                    } else return null
                }
                
                // Create the PaulStretch object
                paulstretch = new PaulStretch(format.numberOfChannels, 20.0, 4096)
                
                // Write the whole file to the process queue
                while(blockIn = nextFileSamples()) paulstretch.write(blockIn)
                
                // Process everything
                while(paulstretch.process()) true
                
                // Read the whole processed data to a block
                blockOut = paulstretch.read(blockHelpers.newBlock(1, paulstretch.readQueueLength()))
                
                // Save to a file
                fs.writeFile(__dirname + '/sounds/miles-stretched-mono-stream-test.raw', encoder(blockOut), function(err) {
                    if (err) throw err
                    done()
                })
                
            })
        })
        
        it('should stretch a stereo file of miles', function(done) {
            var format = {bitDepth: 16, numberOfChannels: 2, sampleRate: 44100}
            var decoder = pcm.BufferDecoder(format)
            var encoder = pcm.BufferEncoder(format)
            var blockIn, blockOut
            var samples, readPos = 0, paulstretch
            
            fs.readFile(__dirname + '/sounds/miles-stereo.raw', function(err, dataIn) {
                if (err) throw err
                
                // Extract the samples from the file
                samples = decoder(dataIn)
                
                var nextFileSamples = function() {
                    if ((samples[0].length - readPos) > 256) {
                        readPos += 256
                        return [
                            samples[0].subarray(readPos - 256, readPos),
                            samples[1].subarray(readPos - 256, readPos)
                        ]
                    } else return null
                }
                
                // Create the PaulStretch object
                paulstretch = new PaulStretch(format.numberOfChannels, 8.0, 4096)
                
                // Write the whole file to the process queue
                while(blockIn = nextFileSamples()) paulstretch.write(blockIn)
                
                // Process everything
                while(paulstretch.process()) true
                
                // Read the whole processed data to a block
                blockOut = paulstretch.read(blockHelpers.newBlock(2, paulstretch.readQueueLength()))
                
                // Save to a file
                fs.writeFile(__dirname + '/sounds/miles-stretched-stereo-stream-test.raw', encoder(blockOut), function(err) {
                    if (err) throw err
                    done()
                })
                
            })
        })
        
    })
    
})