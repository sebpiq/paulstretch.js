import numpy as np
import matplotlib.pyplot as plt
import pdb
WIN = 1024.0
frameRate = 44100

# Generate a signal cos(2PI 500 t) + cos(2PI 1500 t)
times = np.arange(0, WIN, 1) / frameRate
signal = 0.6 * np.cos(times * 2 * np.pi * 500) + 0.35 * np.cos(times * 2 * np.pi * 1500)

# Compute the frequency spectrum with a FFT 
spectrum = np.fft.rfft(signal)
amplitudes = abs(spectrum)[0:WIN/2] * 2/WIN
freqs = np.arange(0, WIN / 2, 1) * frameRate / WIN

# Recompute the original signal by performing the inverse transform
reconstructed = np.fft.irfft(spectrum)

plt.subplot(3, 1, 1)
plt.title('Original signal')
plt.plot(times, signal)

plt.subplot(3, 1, 2)
plt.title('Spectrum')
plt.plot(freqs, amplitudes)

plt.subplot(3, 1, 3)
plt.title('Reconstructed signal')
plt.plot(times, reconstructed)

plt.show()