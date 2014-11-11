var newBlock = module.exports.newBlock = function(numberOfChannels, blockSize) {
  var block = [], ch
  for (ch = 0; ch < numberOfChannels; ch++)
    block.push(new Float32Array(blockSize))
  return block
}