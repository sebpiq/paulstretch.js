var _ = require('underscore')
  , async = require('async')
  , assert = require('assert')
  , utils = require('../lib/utils')
  , blockHelpers = require('../lib/block-helpers')
  , arrayHelpers = require('../lib/array-helpers')
  , assertDeepApproxEqual = require('./helpers').assertDeepApproxEqual
  , blockToArrays = require('./helpers').blockToArrays

describe('utils', function() {

  describe('Samples', function(done) {

    it('should buffer stereo samples as expected', function() {
      var counter = 0
        , producer = function() {
          counter++
          return [
            new Float32Array([counter, counter, counter, counter]),
            new Float32Array([counter, counter, counter, counter])
          ]
        }
        , blockOut = blockHelpers.newBlock(2, 2)
        , samples = new utils.Samples(1)

      samples.write(producer())
      assert.deepEqual(blockToArrays(samples.read(blockOut)), [[1, 1], [1, 1]])
      assert.deepEqual(blockToArrays(samples.read(blockOut)), [[1, 1], [1, 1]])
      assert.deepEqual(blockToArrays(samples.read(blockOut)), [[1, 1], [1, 1]])
      assert.equal(samples.read(blockOut), null)

      samples.write(producer())
      assert.deepEqual(blockToArrays(samples.read(blockOut)), [[1, 2], [1, 2]])
      assert.deepEqual(blockToArrays(samples.read(blockOut)), [[2, 2], [2, 2]])
      assert.deepEqual(blockToArrays(samples.read(blockOut)), [[2, 2], [2, 2]])
      assert.deepEqual(blockToArrays(samples.read(blockOut)), [[2, 2], [2, 2]])
      assert.equal(samples.read(blockOut), null)

      samples.write(producer())
      samples.write(producer())
      assert.deepEqual(blockToArrays(samples.read(blockOut)), [[2, 3], [2, 3]])
      assert.deepEqual(blockToArrays(samples.read(blockOut)), [[3, 3], [3, 3]])
      assert.deepEqual(blockToArrays(samples.read(blockOut)), [[3, 3], [3, 3]])
      assert.deepEqual(blockToArrays(samples.read(blockOut)), [[3, 3], [3, 3]])
      assert.deepEqual(blockToArrays(samples.read(blockOut)), [[3, 4], [3, 4]])
      assert.deepEqual(blockToArrays(samples.read(blockOut)), [[4, 4], [4, 4]])
      assert.deepEqual(blockToArrays(samples.read(blockOut)), [[4, 4], [4, 4]])
      assert.ok(samples.read(blockOut) === blockOut)
    })

    it('should buffer mono samples as expected', function() {
      var counter = 0
        , producer = function() {
          counter++
          return [ new Float32Array([counter, counter]) ]
        }
        , blockOut = blockHelpers.newBlock(1, 1)
        , samples = new utils.Samples()

      samples.write(producer())
      assert.deepEqual(blockToArrays(samples.read(blockOut)), [[1]])
      assert.deepEqual(blockToArrays(samples.read(blockOut)), [[1]])
      assert.equal(samples.read(blockOut), null)

      samples.write(producer())
      assert.deepEqual(blockToArrays(samples.read(blockOut)), [[2]])
      assert.deepEqual(blockToArrays(samples.read(blockOut)), [[2]])
      assert.equal(samples.read(blockOut), null)

      samples.write(producer())
      samples.write(producer())
      samples.write(producer())
      samples.write(producer())
      assert.deepEqual(blockToArrays(samples.read(blockOut)), [[3]])
      assert.deepEqual(blockToArrays(samples.read(blockOut)), [[3]])
      assert.deepEqual(blockToArrays(samples.read(blockOut)), [[4]])
      assert.deepEqual(blockToArrays(samples.read(blockOut)), [[4]])
      assert.deepEqual(blockToArrays(samples.read(blockOut)), [[5]])
      assert.deepEqual(blockToArrays(samples.read(blockOut)), [[5]])
      assert.deepEqual(blockToArrays(samples.read(blockOut)), [[6]])
      assert.deepEqual(blockToArrays(samples.read(blockOut)), [[6]])
    })

    it('should flush properly when needed', function() {
      var producer = function(count) {
          var ch1 = new Float32Array(count)
            , ch2 = new Float32Array(count)
          arrayHelpers.map(ch1, function() { return 1 })
          arrayHelpers.map(ch2, function() { return 1 })
          return [ch1, ch2]
        }
        , blockOut = blockHelpers.newBlock(2, 1)
        , samples = new utils.Samples()

      samples.write(producer(9))
      assert.equal(samples.getFramesAvailable(), 9)
      assert.equal(samples.getReadPos(), 0)

      _(8).times(function() { assert.ok(samples.read(blockOut)) })
      assert.equal(samples.getReadPos(), 8)
      assert.equal(samples.getFramesAvailable(), 1)
      samples.read(blockOut)
      assert.equal(samples.getFramesAvailable(), 0)
      assert.equal(samples.getReadPos(), 9)

      samples.write(producer(15))
      assert.equal(samples.getReadPos(), 9)
      assert.equal(samples.getFramesAvailable(), 15)

      _(8).times(function() { assert.ok(samples.read(blockOut)) })
      assert.equal(samples.getReadPos(), 8)
      assert.equal(samples.getFramesAvailable(), 7)
      samples.read(blockOut)
      assert.equal(samples.getReadPos(), 9)
      assert.equal(samples.getFramesAvailable(), 6)

    })

  })

  describe('makeRephaser', function() {

    it('should change the phases rightly', function() {
      // Test case generated with 'test/scripts/set_phases_testcase.py'

      var rephase = utils.makeRephaser(16)
        , signal = new Float32Array([1, 0, 1, 0, 1, 0, 1, 1, 1, 1, 1, 0, 1, 0, 1, 0])
        , newPhases = new Float32Array([0.11, 0.11, 0.11, 0.11, 0.11, 0.11, 0.11, 0.11, 0.11])
        , sigPhasesChanged = rephase(signal, newPhases)

      assertDeepApproxEqual(sigPhasesChanged, 
        [1.99470576, 0.18223196, 1.18414136, 0.18223196, 0.64253955, 0.23712111,
          0.80377083, 0.23712111, 0.69603953, 0.25985694, 0.80377083, 0.25985694,
          0.64253955, 0.31474609, 1.18414136, 0.31474609],
        0.001
      )

    })

  })

  describe('createWindow', function() {

    it('should create the window', function() {
      // test values are from Python paulstretch
      var expected = [0, 0.47963335, 0.86309648, 1, 0.86309648, 0.47963335, 0]
      assertDeepApproxEqual(utils.createWindow(7), expected, 0.000001)
    })

  })

  describe('applyWindow', function() {

    it('should apply the window to the samples', function() {
      // test values are from Python paulstretch
      var expected = [0, 0.47963335, 0.86309648, 1, 0.86309648, 0.47963335, 0]
        , winArray = utils.createWindow(7)
        , samples

      // Mono
      samples = [new Float32Array([1, 1, 1, 1, 1, 1, 1])]
      utils.applyWindow(samples, winArray)
      assertDeepApproxEqual(samples[0], expected, 0.000001)

      // Stereo
      samples = [
        new Float32Array([1, 1, 1, 1, 1, 1, 1]),
        new Float32Array([1, 1, 1, 1, 1, 1, 1])
      ]
      utils.applyWindow(samples, winArray)
      assertDeepApproxEqual(samples[0], expected, 0.000001)
      assertDeepApproxEqual(samples[1], expected, 0.000001)
    })

  })

})