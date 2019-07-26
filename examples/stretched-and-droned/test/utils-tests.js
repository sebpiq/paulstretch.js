var utils = require('../src/utils')
var assert = require('assert')

describe('upsample', function() {
    
    it('should interpolate correctly if same number of points', function() {
        var samples = new Float32Array([1, 2, 3, 4, 5, 6])
        upsampled = utils.upsample(samples, 6)
        assert.deepEqual([].slice.call(upsampled, 0), [1, 2, 3, 4, 5, 6])
    })
    
    it('should interpolate correctly with higher number of points', function() {
        var samples = new Float32Array([1, 2, 3, 4, 5, 6])
        upsampled = utils.upsample(samples, 9)
        assert.deepEqual([].slice.call(upsampled, 0), [1, 1.625, 2.25, 2.875, 3.5, 4.125, 4.75, 5.375, 6])
    })
    
})