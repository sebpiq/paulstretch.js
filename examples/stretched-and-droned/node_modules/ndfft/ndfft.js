"use strict";

var bits = require("bit-twiddle");

//Cached buffers
var x0 = new Float64Array(4096);
var y0 = new Float64Array(4096);
function realloc(n) {
  if(x0.length < n) {
    x0 = new Float64Array(n);
    y0 = new Float64Array(n);
  }
}

//In place 1D FFT
function fft(dir,m,x,y) {
  var nn,i,i1,j,k,i2,l,l1,l2;
  var c1,c2,tx,ty,t1,t2,u1,u2,z;
  
  /* Calculate the number of points */
  nn = 1<<m;
  
  /* Do the bit reversal */
  i2 = nn >> 1;
  j = 0;
  for (i=0;i<nn-1;i++) {
    if (i < j) {
      tx = x[i];
      ty = y[i];
      x[i] = x[j];
      y[i] = y[j];
      x[j] = tx;
      y[j] = ty;
    }
    k = i2;
    while (k <= j) {
      j -= k;
      k >>= 1;
    }
    j += k;
  }
  
  /* Compute the FFT */
  c1 = -1.0;
  c2 = 0.0;
  l2 = 1;
  for (l=0;l<m;l++) {
    l1 = l2;
    l2 <<= 1;
    u1 = 1.0;
    u2 = 0.0;
    for (j=0;j<l1;j++) {
      for (i=j;i<nn;i+=l2) {
        i1 = i + l1;
        t1 = u1 * x[i1] - u2 * y[i1];
        t2 = u1 * y[i1] + u2 * x[i1];
        x[i1] = x[i] - t1;
        y[i1] = y[i] - t2;
        x[i] += t1;
        y[i] += t2;
      }
      z =  u1 * c1 - u2 * c2;
      u2 = u1 * c2 + u2 * c1;
      u1 = z;
    }
    c2 = Math.sqrt((1.0 - c1) / 2.0);
    if (dir === 1)
      c2 = -c2;
    c1 = Math.sqrt((1.0 + c1) / 2.0);
  }
  
  /* Scaling for forward transform */
  if (dir == -1) {
    var scale_f = 1.0 / nn;
    for (i=0;i<nn;i++) {
      x[i] *= scale_f;
      y[i] *= scale_f;
    }
  }
}

//In place 2D fft
function fft2(dir, m, n, x, y) {
  realloc(x.length);
  for(var i=0; i<x.length; ++i) {
    fft(dir, m, x[i], y[i]);
  }
  for(var j=0; j<x[0].length; ++j) {
    for(var i=0; i<x.length; ++i) {
      x0[i] = x[i][j];
      y0[i] = y[i][j];
    }
    fft(dir, n, x0, y0);
    for(var i=0; i<x.length; ++i) {
      x[i][j] = x0[i];
      y[i][j] = y0[i];
    }
  }
}

//In place 3D fft
function fft3(dir, m, n, p, x, y) {
  realloc(Math.max(x.length, x[0].length));
  for(var i=0; i<x.length; ++i) {
    var rx = x[i];
    var ry = y[i];
    for(var j=0; j<rx.length; ++j) {
      fft(dir, m, rx[j], ry[j]);
    }
    for(var j=0; j<rx[0].length; ++j) {
      for(var k=0; k<rx.length; ++k) {
        x0[k] = rx[k][j];
        y0[k] = ry[k][j];
      }
      fft(dir, n, x0, y0);
      for(var k=0; k<rx.length; ++k) {
        rx[k][j] = x0[k];
        ry[k][j] = y0[k];
      }
    }
  }
  for(var i=0; i<x[0].length; ++i) {
    for(var j=0; j<x[0][0].length; ++j) {
      for(var k=0; k<x.length; ++k) {
        x0[k] = x[k][i][j];
        y0[k] = y[k][i][j];
      }
      fft(dir, p, x0, y0);
      for(var k=0; k<x.length; ++k) {
        x[k][i][j] = x0[k];
        y[k][i][j] = y0[k];
      }
    }
  }
}


function get_item(x, coord, n) {
  if(n === 1) {
    return x[coord[0]];
  }
  return get_item(x[coord[n-1]], coord, n-1);
}

function set_item(x, coord, n, v) {
  if(n === 1) {
    x[coord[0]] = v;
    return;
  }
  set_item(x[coord[n-1]], coord, n-1, v);
}

//Slow sweeping algorithm
function fft_sweep(dir, n, coord, x, y) {
  if(n < coord.length-1) {
    for(var i=0; i<x[n].length; ++i) {
      coord[n] = i;
      fft_sweep(dir, n+1, coord, x, y);
    }
    return;
  }
  for(var i=0; i<x.length; ++i) {
    coord[n] = i;
    x0[i] = get_item(x, coord, coord.length);
    y0[i] = get_item(y, coord, coord.length);
  }
  fft(dir, bits.log2(x.length), x0, y0);
  for(var i=0; i<x.length; ++i) {
    coord[n] = i;
    set_item(x, coord, coord.length, x0[i]);
    set_item(y, coord, coord.length, y0[i]);
  }
}

//Compute dimension of tensor
function dimension(x) {
  var d = 0;
  while(x instanceof Array) {
    ++d;
    x = x[0];
  }
  return d;
}

//In place n-dimensional fft
function fftn(dir, x, y) {
  //First, handle easy cases
  var n = dimension(x);
  switch(n) {
    case 0:
      return;
    case 1:
      return fft(dir, bits.log2(x.length), x, y);
    case 2:
      return fft2(dir, bits.log2(x[0].length), bits.log2(x.length), x, y);
    case 3:
      return fft3(dir, bits.log2(x[0][0].length), bits.log2(x[0].length), bits.log2(x.length), x, y);
    default:
    break;
  }
  //Slow/unusual case: Handle higher dimensions
  for(var i=0; i<x.length; ++i) {
    fftn(dir, x[i], y[i]);
  }
  realloc(x.length);
  fft_sweep(dir, 0, new Array(n), x, y);
}

module.exports = fftn;
