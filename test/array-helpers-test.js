var assert = require('assert')
  , arrayHelpers = require('../lib/array-helpers')
  , assertDeepApproxEqual = require('./helpers').assertDeepApproxEqual
  , blockToArrays = require('./helpers').blockToArrays


describe('array-helpers', function() {

  describe('map', function() {

    it('should apply a function to all elems', function() {
      var array = new Float32Array([-1, 2, -3, 4, -5])
      arrayHelpers.map(array, function(v) { return v * 11 })
      assert.deepEqual([].slice.call(array, 0), [-11, 22, -33, 44, -55])
      arrayHelpers.map(array, Math.abs)
      assert.deepEqual([].slice.call(array, 0), [11, 22, 33, 44, 55])
    })

  })

  describe('duplicate', function() {

    it('should duplicate an array rightly', function() {
      var array = new Float32Array([1, 2, 3, 4, 5])
        , copied = arrayHelpers.duplicate(array)
      assert.deepEqual([].slice.call(copied, 0), [1, 2, 3, 4, 5])
      array[0] = 222
      assert.equal(copied[0], 1)
    })

  })

  describe('copy', function() {

    it('should copy an array to another', function() {
      var array = new Float32Array([1, 2, 3, 4, 5])
        , copied = new Float32Array(5)
      arrayHelpers.copy(array, copied)
      assert.deepEqual([].slice.call(copied, 0), [1, 2, 3, 4, 5])
      array[0] = 222
      assert.equal(copied[0], 1)
    })

  })

  describe('add', function() {

    it('should add 2 blocks', function() {
      var array1 = new Float32Array([1, 2, 3, 4, 5])
        , array2 = new Float32Array([0.1, 0.2, 0.2, 0.3, 0.4])
      arrayHelpers.add(array1.subarray(0, 2), array2.subarray(0, 2))
      assertDeepApproxEqual([].slice.call(array1, 0), [1.1, 2.2, 3, 4, 5], 0.000001)
    })

  })

})