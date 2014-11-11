var numeric = require("numeric");

var x = numeric.rep([4, 4, 4], 0.0);
var y = numeric.rep([4, 4, 4], 0.0);

x[0][0][0] = 1.0;

console.log(x,y);

var fft = require("../ndfft.js");

fft(1, x, y);
fft(-1, x, y);


console.log(x, y);