var EventEmitter = require('events').EventEmitter
, globals = require('./globals')
, utils = require('./utils')

class TrackView extends EventEmitter {
    
    constructor(root, display) {
        super()
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
        
        var stretchModuleContainer = $('<div>', {class: 'module'}).appendTo(this.trackContainer)
        var ampModModuleContainer = $('<div>', {class: 'module'}).appendTo(this.trackContainer)
        var filterModuleContainer = $('<div>', {class: 'module'}).appendTo(this.trackContainer)
        var gainModuleContainer = $('<div>', {class: 'module'}).appendTo(this.trackContainer)
        var trackInfosContainer = $('<div>', {class: 'module'}).appendTo(this.trackContainer)
        
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
        this.stretchDial = this.makeDial(
            stretchModuleContainer, 'stretch', 'Ratio',
            (val) => 1 + utils.mapExp(val, 10) * 999,
            (val) => utils.reverseMapExp((val - 1) / 999, 10),
        )
        
        this.ampModShapeContainer = $('<div>', {class: 'control'}).appendTo(ampModModuleContainer)
        $('<div>', {class: 'controlTitle'}).html('Envelope').appendTo(this.ampModShapeContainer)
        this.ampModShapeMultiSlider = makeNxObject('multislider', this.ampModShapeContainer)
        this.ampModShapeMultiSlider.set([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], false)
        this.ampModShapeMultiSlider.on('value', (array) => {
            this.emit('change:ampModShape', new Float32Array(array))
        })
        this.ampModShapeMultiSlider.draw()
        $('<div>', {class: 'feedback invisible'}).html('&nbsp;').appendTo(this.ampModShapeContainer)
        
        this.ampModFreqDial = this.makeDial(
            ampModModuleContainer, 'ampModFreq', 'Frequency',
            (val) => utils.round(0.1 + utils.mapExp(val, 4) * 80, 1),
            (val) => utils.reverseMapExp((val - 0.1) / 80, 4),
        )
        
        this.filterQDial = this.makeDial(
            filterModuleContainer, 'filterQ', 'Q',
            (val) => 0.0001 + utils.mapExp(val, 6) * 100,
            (val) => utils.reverseMapExp((val - 0.0001) / 100, 6),
        )

        this.filterFreqDial = this.makeDial(
            filterModuleContainer, 'filterFreq', 'Frequency',
            (val) => 0.0001 + utils.mapExp(val, 2) * 4000,
            (val) => utils.reverseMapExp((val - 0.0001) / 4000, 2),
        )
        
        this.volumeDial = this.makeDial(
            gainModuleContainer, 'volume', 'Amount',
            (val) => 0.0001 + utils.mapExp(val, 2) * 4,
            (val) => utils.reverseMapExp((val - 0.0001) / 4, 2),
        )
        
        this.refresh()
    }
    
    setReady() {
        this.trackContainer.removeClass('loading')
    }
    
    setError() {
        this.trackContainer.removeClass('loading')
        this.trackContainer.addClass('errored')
    }
    
    destroy() {
        this.trackContainer.remove()
        this.emit('destroy')
    }
    
    refresh() {
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
    
    makeDial(root, paramName, controlTitle, dialToActualMap, actualToDialMap) {
        var container = $('<div>', {class: 'control'}).appendTo(root)
        var controlTitleElem = $('<div>', {class: 'controlTitle'}).html(controlTitle).appendTo(container)
        var dial = makeNxObject('dial', container)
        var feedbackElem = $('<div>', {class: 'feedback'}).appendTo(container)
        
        dial.on('value', (val) => {
            val = dialToActualMap(val)
            this.emit('change:' + paramName, val)
            $(feedbackElem).html(getDisplay(val))
        })
        
        this['set' + paramName.charAt(0).toUpperCase() + paramName.slice(1)] = function(val) {
            dial.set({value: actualToDialMap(val)}, false)
            $(feedbackElem).html(getDisplay(val))
        }
        return dial
    }
    
}

var makeNxObject = function(nxType, container) {
    var size = globals.width > 600 ? globals.width / 13 : globals.width / 5.5
    var canvas = $('<canvas>').attr({
        'width': size,
        'height': size,
        'nx': nxType
    }).appendTo(container)
    return nx.createNxObject(canvas.get(0))
}

var getDisplay = function(val) {
    var display = ('' + utils.round(val, 2)).split('.')
    if (display.length === 2) display[1] = display[1].slice(0, 2)
    return display.join('.')
}

module.exports = TrackView