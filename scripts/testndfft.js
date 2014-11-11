var fs = require('fs')
  , fft = require('ndfft')
  , math = require('mathjs')
  , WIN = 1024
  , frameRate = 44100
  , times, signal, re, im, amplitudes

var writeValuesToFile = function(filename, x, y) {
  var dataStr = ''
  y.forEach(function(val, i) {
    dataStr += '' + x[i] + ' ' + val + '\n'
  })
  fs.writeFileSync(filename, dataStr)
}

// Generate a signal cos(2PI 500 t) + cos(2PI 1500 t)
times = math.emultiply(math.range(0, WIN - 1).toMatrix(), 1 / frameRate)
signal = math.add(
  math.multiply(math.cos(math.emultiply(times, 2 * math.PI * 500)), 0.6),
  math.multiply(math.cos(math.emultiply(times, 2 * math.PI * 1500)), 0.35)
)
re = signal.toArray()
im = math.squeeze(math.zeros([1, WIN])).toArray()

// Compute the frequency spectrum with a FFT 
fft(1, re, im)
amplitudes = math.epow(math.add(math.epow(re, 2), math.epow(im, 2)), 0.5)
amplitudes = math.emultiply(amplitudes, 2/WIN)

// Recompute the original signal by performing the inverse transform
fft(-1, re, im)

// Only positive frequencies
writeValuesToFile('signal.dat', times.toArray(), signal.toArray())
writeValuesToFile('fft.dat', 
  math.emultiply(math.range(0, WIN / 2 - 1), frameRate / WIN),
  amplitudes.slice(0, WIN / 2)
)
writeValuesToFile('ifft.dat', times.toArray(), re)
