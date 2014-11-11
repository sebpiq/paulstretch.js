var add = module.exports.add = function(array1, array2) {
  var i, length = array1.length
  for (i = 0; i < length; i++)
    array1[i] += array2[i]
  return array1
}

var map = module.exports.map = function(array, func) {
  var i, length
  for (i = 0, length = array.length; i < length; i++) array[i] = func(array[i])
  return array
}

var duplicate = module.exports.duplicate = function(array) {
  return copy(array, new Float32Array(array.length))
}

var copy = module.exports.copy = function(array1, array2) {
  var i, length
  for (i = 0, length = array1.length; i < length; i++) array2[i] = array1[i]
  return array2
}