set title "values"
set autoscale
set multiplot layout 3, 1

set title "Signal"
unset key
set xtics 0,0.002,0.025
set style line 1 lc rgb '#0000ad' lt 3 lw 3 pt 0
plot "signal.dat" with linespoints ls 1

set title "FFT amplitudes"
unset key
set xtics 0,500,22050
set style line 1 lc rgb '#0000ad' lt 3 lw 3 pt 0
plot "fft.dat" with linespoints ls 1

set title "Inverse FFT"
unset key
set xtics 0,0.002,0.025
set style line 1 lc rgb '#0000ad' lt 3 lw 3 pt 0
plot "ifft.dat" with linespoints ls 1

unset multiplot