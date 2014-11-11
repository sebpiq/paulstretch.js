import numpy as np
WIN = 16
frameRate = 44100
times = np.arange(0, WIN, 1) / frameRate
signal = np.array([1, 0, 1, 0, 1, 0, 1, 1, 1, 1, 1, 0, 1, 0, 1, 0])

amplitudes = abs(np.fft.rfft(signal, axis=0))
ph = np.array([0.11, 0.11, 0.11, 0.11, 0.11, 0.11, 0.11, 0.11, 0.11])
amplitudes = amplitudes * np.exp(ph * 1j)
print np.fft.irfft(amplitudes, axis=0)