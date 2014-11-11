importScripts('paulstretch.js')

var debugActivated = true
  , paulStretch
  , batchSize, blockSize, blocksOut = []

onmessage = function (event) {
  switch ( event.data.type ) {

  case 'init':
    // Initializing the paulstretch object
    paulStretch = new PaulStretch(event.data.numberOfChannels, event.data.ratio, event.data.winSize)

    // Initializing other settings
    batchSize = event.data.batchSize
    blockSize = event.data.blockSize

    // Initializing `blockOuts` to contain several blocks (i.e arrays of Float32Array)
    // That we are going to reuse to avoid allocations.
    for (var i = 0; i < batchSize; i++) {
      blocksOut.unshift([])
      for (var ch = 0; ch < event.data.numberOfChannels; ch++)
        blocksOut[0].push(new Float32Array(blockSize))
    }

    debug('initialized ' + paulStretch.toString())
    break

  case 'config':
    paulStretch.setRatio(event.data.ratio)
    debug('change config, ratio : ' + event.data.ratio)
    break

  case 'read':
    var i

    // Process until we have more than `batchSize` blocks,
    // or until we don't have enough frames to process. 
    while ((paulStretch.readQueueLength() < (batchSize * blockSize)) 
      && (paulStretch.process() !== 0)) paulStretch.readQueueLength()

    // Reads and sends `batchSize` blocks or gives up for now
    if (Math.floor(paulStretch.readQueueLength() / blockSize) >= batchSize) {
      for (i = 0; i < batchSize; i++) paulStretch.read(blocksOut[i])
      postMessage({ type: 'read', data: blocksOut })
    } else debug('not enough blocks ready')
    break

  // Just write the incoming blocks to the write queue
  case 'write':
    paulStretch.write(event.data.data)
    break
  }

}

var debug = function(msg) {
  if (debugActivated) console.log(msg)
}