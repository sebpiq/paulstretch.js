var FFT = require('fft')
  , i = new Float32Array([1, 0,
    0, 0,
    1, 0,
    0, 0,
    1, 0,
    0, 0,
    1, 0,
    1, 0,
    1, 0,
    1, 0,
    1, 0,
    0, 0,
    1, 0,
    0, 0,
    1, 0,
    0, 0])
  , n = i.length
  , o1 = new Float32Array(n)
  , o2 = new Float32Array(n)
  , fft = new FFT.complex(n / 2, false)
  , ifft = new FFT.complex(n / 2, true)

var logArr = function(arr) { console.log([].slice.call(arr, 0)) }

fft.process(o1, 0, 1, i, 0, 1)
ifft.process(o2, 0, 1, o1, 0, 1)
logArr(o2)