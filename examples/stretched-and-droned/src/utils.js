exports.mapExp = function(x, a) {
    return (Math.exp(x * a) - Math.exp(0)) / (Math.exp(a) - Math.exp(0))
}

exports.reverseMapExp = function(x, a) {
    return Math.log(x * (Math.exp(a) - Math.exp(0)) + Math.exp(0)) / a
}

exports.upsample = function(y, numPoints) {
    var m, b
    var x, interpX, interpXStep = (y.length - 1) / (numPoints - 1), i
    var interpY = new Float32Array(numPoints)
    
    i = 0
    interpX = 0
    for (x = 0; x < y.length - 1; x++) {
        m = (y[x + 1] - y[x])
        b = y[x] - m * x
        
        while (interpX <= x + 1) {
            interpY[i++] = m * interpX + b
            interpX += interpXStep
        }
    }
    
    return interpY
}

exports.round = function(val, decimal) {
    return Math.round(val * Math.pow(10, decimal)) / Math.pow(10, decimal)
}