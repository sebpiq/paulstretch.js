ndfft
=====
Complex n-dimensional radix-2 FFT codes for JavaScript.  Derived from [Paul Bourke's C FFT codes](http://paulbourke.net/miscellaneous/dft/).  This routine is not particularly optimized, but it should get the job done.

Usage/Install
=============
To install:

    npm install ndfft
    
And to use it

    var ndfft = require("ndfft");
    
    var re = [[1, 0], [0, 0]];
    var im = [[0, 0], [0, 0]];
    
    //Forward transform
    ndfft(1, re, im);

    //Inverse transform
    ndfft(-1, re, im);


`require("ndfft")(direction, real, imag)`
-----------------------------------------
Executes an n-place n-dimensional Fast Fourier transform.

* `direction`: a number set to +/- 1, representing the direction of the fft.
* `real`: The real part of the array.  Each dimension must be a power of two.
* `imag`: The imaginary part of the array.  Must have same dimensions as x

The fourier transform is computed in place.  No value is returned from this method.

Credits
=======
(c) 1993 Paul Bourke.  Public domain

JavaScript port by Mikola Lysenko (c) 2013.
