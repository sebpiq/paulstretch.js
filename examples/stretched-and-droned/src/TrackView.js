var EventEmitter = require('events').EventEmitter
  , globals = require('./globals')
  , inherits = require('util').inherits
  , utils = require('./utils')

var TrackView = module.exports = function(root, display) {
  EventEmitter.apply(this)

  // Setting-up the DOM
  this.root = root
  this.trackContainer = $('<div>', {class: 'track loading'}).appendTo(this.root)
  
  this.loader = $('<div>', {class: 'loader'}).appendTo(this.trackContainer)
  $('<div>', {class: 'loaderText'})
    .html('loading <button class="cancelLoad">X</button>')
    .appendTo(this.loader)

  this.errorMessage = $('<div>', {class: 'errorMessage'}).appendTo(this.trackContainer)
  $('<div>', {class: 'errorText'})
    .html('track couldn\'t load <button class="cancelLoad">X</button>')
    .appendTo(this.errorMessage)

  var self = this
    , stretchModuleContainer = $('<div>', {class: 'module'}).appendTo(this.trackContainer)
    , ampModModuleContainer = $('<div>', {class: 'module'}).appendTo(this.trackContainer)
    , filterModuleContainer = $('<div>', {class: 'module'}).appendTo(this.trackContainer)
    , gainModuleContainer = $('<div>', {class: 'module'}).appendTo(this.trackContainer)
    , trackInfosContainer = $('<div>', {class: 'module'}).appendTo(this.trackContainer)

  $('<div>', {class: 'moduleTitle'}).html('Paulstretch').appendTo(stretchModuleContainer)
  $('<div>', {class: 'moduleTitle'}).html('Amplitude modulator').appendTo(ampModModuleContainer)
  $('<div>', {class: 'moduleTitle'}).html('Bandpass').appendTo(filterModuleContainer)
  $('<div>', {class: 'moduleTitle'}).html('Gain').appendTo(gainModuleContainer)
  $('<div>', {class: 'moduleTitle trackInfos'}).html(display.slice(0, 20) + ' ...')
    .appendTo(trackInfosContainer)

  $('<button>', { class: 'deleteTrack' })
    .appendTo(trackInfosContainer)
    .html('remove track')
    .click(this.destroy.bind(this))

  $('button.cancelLoad').click(this.destroy.bind(this))


  // Creating controls
  this.stretchDial = this.makeDial(stretchModuleContainer, 'stretch', 'Ratio',
    function(val) { return 1 + utils.mapExp(val, 10) * 999 },
    function(val) { return utils.reverseMapExp((val - 1) / 999, 10) }
  )

  this.ampModShapeContainer = $('<div>', {class: 'control'}).appendTo(ampModModuleContainer)
  $('<div>', {class: 'controlTitle'}).html('Envelope').appendTo(this.ampModShapeContainer)
  this.ampModShapeMultiSlider = makeNxObject('multislider', this.ampModShapeContainer)
  this.ampModShapeMultiSlider.set([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], false)
  this.ampModShapeMultiSlider.on('value', function(array) {
    self.emit('change:ampModShape', new Float32Array(array))
  })
  this.ampModShapeMultiSlider.draw()
  $('<div>', {class: 'feedback invisible'}).html('&nbsp;').appendTo(this.ampModShapeContainer)

  this.ampModFreqDial = this.makeDial(ampModModuleContainer, 'ampModFreq', 'Frequency',
    function(val) { return utils.round(0.1 + utils.mapExp(val, 4) * 80, 1) },
    function(val) { return utils.reverseMapExp((val - 0.1) / 80, 4) }
  )

  this.filterQDial = this.makeDial(filterModuleContainer, 'filterQ', 'Q',
    function(val) { return 0.0001 + utils.mapExp(val, 6) * 100 },
    function(val) { return utils.reverseMapExp((val - 0.0001) / 100, 6) }
  )
  this.filterFreqDial = this.makeDial(filterModuleContainer, 'filterFreq', 'Frequency',
    function(val) { return 0.0001 + utils.mapExp(val, 2) * 4000 },
    function(val) { return utils.reverseMapExp((val - 0.0001) / 4000, 2) }
  )
  this.volumeDial = this.makeDial(gainModuleContainer, 'volume', 'Amount',
    function(val) { return 0.0001 + utils.mapExp(val, 2) * 4 },
    function(val) { return utils.reverseMapExp((val - 0.0001) / 4, 2) }
  )

  this.refresh()
}
inherits(TrackView, EventEmitter)

TrackView.prototype.setReady = function() {
  this.trackContainer.removeClass('loading')
}

TrackView.prototype.setError = function() {
  this.trackContainer.removeClass('loading')
  this.trackContainer.addClass('errored')
}

TrackView.prototype.destroy = function() {
  this.trackContainer.remove()
  this.emit('destroy')
}

TrackView.prototype.refresh = function() {
  this.loader.css({
    width: this.trackContainer.width(),
    height: this.trackContainer.height(),
    top: this.trackContainer.offset().top,
    left: this.trackContainer.offset().left
  })
  this.errorMessage.css({
    width: this.trackContainer.width(),
    height: this.trackContainer.height(),
    top: this.trackContainer.offset().top,
    left: this.trackContainer.offset().left
  })
}

TrackView.prototype.makeDial = function(root, paramName, controlTitle, dialToActualMap, actualToDialMap) {
  var self = this
    , container = $('<div>', {class: 'control'}).appendTo(root)
    , controlTitleElem = $('<div>', {class: 'controlTitle'}).html(controlTitle).appendTo(container)
    , dial = makeNxObject('dial', container)
    , feedbackElem = $('<div>', {class: 'feedback'}).appendTo(container)

  dial.on('value', function(val) {
    val = dialToActualMap(val)
    self.emit('change:' + paramName, val)
    $(feedbackElem).html(getDisplay(val))
  })

  this['set' + paramName.charAt(0).toUpperCase() + paramName.slice(1)] = function(val) {
    dial.set({value: actualToDialMap(val)}, false)
    $(feedbackElem).html(getDisplay(val))
  }
  return dial
}

var makeNxObject = function(nxType, container) {
  var canvas = $('<canvas>').attr({
    'width': globals.width / 13,
    'height': globals.width / 13,
    'nx': nxType
  }).appendTo(container)
  return nx.createNxObject(canvas.get(0))
}

var getDisplay = function(val) {
  var display = ('' + utils.round(val, 2)).split('.')
  if (display.length === 2) display[1] = display[1].slice(0, 2)
  return display.join('.')
}