(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
var EventEmitter = require('events').EventEmitter
var utils = require('./utils')
var globals = require('./globals')
var bufferSize = 4096
var batchSize = 4
var winSize = 4096 * 4
var context = null
var recorderBus

class Track extends EventEmitter {
    
    constructor(audioSource) {
        super()
        this.audioSource = audioSource
        console.log('Track created, ' + this)
        
        this.blocksIn = []
        this.blocksOut = []
        
        this.stretch = 5
        this.volume = 1
        this.ampModFreq = 1
        this.ampModShape = null
        this.filterQ = 0
        this.filterFreq = 400
        
        this.paulstretchWorker = null
        this.paulstretchNode = null
        this.sourceNode = null
        this.ampGainNode = context.createGain()
        this.ampModulatorNode = null
        this.filterNode = context.createBiquadFilter()
        this.filterNode.type = 'bandpass'
        this.filterNode.Q.value = this.filterQ
        this.filterNode.frequency.value = this.filterFreq
        this.mixerNode = context.createGain()
        
        this.audioSource.addEventListener('error', this._onAudioSourceError.bind(this))
        this.audioSource.addEventListener('canplay', this._onAudioSourceCanPlay.bind(this), true)
    }
    
    destroy() {
        if (this.ampModulatorNode) this.ampModulatorNode.stop(0) 
        this.mixerNode.disconnect()
    }
    
    setStretch(ratio) {
        this.stretch = ratio
        this.paulstretchWorker.postMessage({ type: 'config', ratio: ratio })
    }
    
    setVolume(volume) {
        this.volume = volume
        this.mixerNode.gain.exponentialRampToValueAtTime(volume, context.currentTime + 0.05)
    }
    
    setAmpModFreq(freq) {
        this.ampModFreq = freq
        if (this.ampModulatorNode) {
            this.ampModulatorNode.playbackRate.exponentialRampToValueAtTime(freq, context.currentTime + 0.05)
        }
    }
    
    setFilterQ(q) {
        this.filterQ = q
        this.filterNode.Q.linearRampToValueAtTime(q, context.currentTime + 0.05)
    }
    
    setFilterFreq(freq) {
        this.filterFreq = freq
        this.filterNode.frequency.exponentialRampToValueAtTime(freq, context.currentTime + 0.05)
    }
    
    setAmpModShape(array) {
        var buffer = context.createBuffer(1, 44100, context.sampleRate)
        , upsampled = utils.upsample(array, 44100)
        
        buffer.getChannelData(0).set(upsampled)
        this.ampModShape = array
        if (this.ampModulatorNode) {
            this.ampModulatorNode.stop(0)
            this.ampModulatorNode.disconnect()
        } else this.ampGainNode.gain.value = 0 // First time we need to remove the static gain
        this.ampModulatorNode = context.createBufferSource()
        this.ampModulatorNode.loop = true
        this.ampModulatorNode.connect(this.ampGainNode.gain)
        this.ampModulatorNode.buffer = buffer
        this.setAmpModFreq(this.ampModFreq)
        this.ampModulatorNode.start(0)
    }
    
    toString() {
        return this.audioSource.src.slice(0, 40) + '...'
    }

    _onAudioSourceError(err) {
        console.log('Load error track, ' + this)
        this.emit('load:error')
    }

    _onAudioSourceCanPlay() {
        console.log('Can play track, ' + this)    
        var numberOfChannels = 2
        this.paulstretchWorker = new Worker('./js/paulstretch-worker.js')
        this.paulstretchNode = context.createScriptProcessor(bufferSize, numberOfChannels, numberOfChannels)
        
        this.paulstretchWorker.postMessage({
            type: 'init',
            winSize: winSize,
            ratio: this.stretch,
            numberOfChannels: numberOfChannels,
            blockSize: bufferSize,
            batchSize: batchSize,
        })
        
        this.sourceNode = context.createMediaElementSource(this.audioSource)
        this.audioSource.play()
        
        this.paulstretchWorker.onmessage = (event) => {
            // Add all the blocks from the batch to the `blocksOut` queue.
            if (event.data.type === 'read') {
                var blocks = event.data.data
                while (blocks.length) this.blocksOut.push(blocks.shift())
            }
        }
        
        this.paulstretchNode.onaudioprocess = (event) => {
            var ch, block = []
            // Add every incoming block to the `blocksIn` queue
            for (ch = 0; ch < numberOfChannels; ch++)
            block.push(event.inputBuffer.getChannelData(ch))
            this.blocksIn.push(block)
            
            // If there is any processed block, read it ...
            if (this.blocksOut.length) {
                block = this.blocksOut.shift()
                for (ch = 0; ch < numberOfChannels; ch++)
                event.outputBuffer.getChannelData(ch).set(block[ch])
            }
        }
        
        // Periodically, handle the `blockIn` and `blockOut` queues :
        // Send `blocksIn` to the worker for future processing and ask for batches that are ready to put in `blocksOut`.
        setInterval(() => {
            if (this.blocksIn.length)
            this.paulstretchWorker.postMessage({ type: 'write', data: this.blocksIn.shift() })
            
            if (this.blocksOut.length < batchSize) 
            this.paulstretchWorker.postMessage({ type: 'read' })
        }, 100)
        
        this.sourceNode.connect(this.paulstretchNode)
        this.paulstretchNode.connect(this.ampGainNode)
        this.ampGainNode.connect(this.filterNode)
        this.filterNode.connect(this.mixerNode)
        this.mixerNode.connect(recorderBus)
        
        this.emit('load:ready')
    }

}

Track.ensureAudioContext = () => {
    if (!context) {
        console.log('creating audio context')
        context = new AudioContext
        recorderBus = context.createGain()
        recorderBus.connect(context.destination)
        globals.recorder = new Recorder(recorderBus)        
    }
}

module.exports = Track
},{"./globals":3,"./utils":6,"events":7}],2:[function(require,module,exports){
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
},{"./globals":3,"./utils":6,"events":7}],3:[function(require,module,exports){
exports.appWidth = null
exports.fsToken = '9c285499c27fdb0322da949ef05d5189a09dd4e4'
exports.scToken = 'c9c439eb2401e825566ba09d71abe007'
},{}],4:[function(require,module,exports){
$(function() {
    
    var hideModal = function() {
        $('.modal').fadeOut()
        $('#modalOverlay').fadeOut()
        $('#modalContainer').removeClass('visible')
    }
    
    var showModal = function(selector) {
        $('.modal').hide()
        $(selector).fadeIn()
        $('#modalOverlay').fadeIn()
        $('#modalContainer').addClass('visible')
    }
    
    $('#modalOverlay').click(hideModal.bind(this))
    $('#showAbout').click(showModal.bind(this, '#aboutModal'))
    
    // Feature and browser detection
    var ffResult, ffVersion
    if (!window.AudioContext) {
        showModal('#noWebAudioAPIError')
        $('#createTrack').hide()
        $('#recContainer').hide()
        return
    } else if (ffResult = /firefox\/([0-9]+)/.exec(navigator.userAgent.toLowerCase())) {
        ffVersion = parseInt(ffResult[1])
        if (ffVersion < 37) {
            showModal('#firefoxError')
            $('#createTrack').hide()
            $('#recContainer').hide()
            return
        }
    }
    
    // Initializing the app
    var globals = require('./globals')
    var Track = require('./Track')
    var TrackView = require('./TrackView')
    var soundSources = require('./soundSources')
    
    nx.colorize('#009ee0')
    nx.colorize('border', '#272727')
    nx.colorize('fill', '#272727')
    
    globals.width = $(window).width()
    var trackViewsContainer = $('#trackViews')
    var tracks = []
    var maxTracks = 6
    
    var createTrack = function(url, display) {
        var audioSource = new Audio()
        var track
        audioSource.crossOrigin = 'anonymous'
        audioSource.src = url
        track = {
            model: new Track(audioSource),
            view: new TrackView(trackViewsContainer, display)
        }
        
        tracks.push(track)
        
        track.view.on('destroy', function() {
            track.view.removeAllListeners()
            track.model.destroy()
            tracks.splice(tracks.indexOf(track), 1)
            tracks.forEach(function(t) { t.view.refresh() })
        })
        
        track.view.on('change:stretch', track.model.setStretch.bind(track.model))
        track.view.setStretch(track.model.stretch)
        
        track.view.on('change:volume', track.model.setVolume.bind(track.model))
        track.view.setVolume(track.model.volume)
        
        track.view.on('change:ampModFreq', track.model.setAmpModFreq.bind(track.model))
        track.view.setAmpModFreq(track.model.ampModFreq)
        
        track.view.on('change:filterQ', track.model.setFilterQ.bind(track.model))
        track.view.setFilterQ(track.model.filterQ)
        
        track.view.on('change:filterFreq', track.model.setFilterFreq.bind(track.model))
        track.view.setFilterFreq(track.model.filterFreq)
        
        track.view.on('change:ampModShape', track.model.setAmpModShape.bind(track.model))
        
        track.model.on('load:ready', track.view.setReady.bind(track.view))
        track.model.on('load:error', track.view.setError.bind(track.view))
    }
    
    
    $('#createTrack').click(function() {
        Track.ensureAudioContext()
        if (tracks.length < maxTracks) {
            showModal('#soundSourcesModal')
            $('#soundSourcesModal form input[type="text"]').focus()
        } else showModal('#maxTracksReachedModal')
    })
    
    
    soundSources.emitter.on('selected', function(r) {
        createTrack(r.url, r.display)
        hideModal('#soundSourcesModal')
    })
    
    new soundSources.SoundCloudSourceView($('#soundCloudSource'))
    SC.initialize({ client_id: globals.scToken })
    //new soundSources.FreeSoundSourceView($('#freesoundSource'))
    
    $('#toggleRec').click(function() {
        var button = $(this)
        if (!button.hasClass('recording')) {
            globals.recorder.record()
            button.html('Recording...')
            button.addClass('recording')
        } else {
            globals.recorder.stop()
            button.html('Record')
            button.removeClass('recording')
            createDownload()
            globals.recorder.clear()
        }
    })
    
    var createDownload = function() {
        globals.recorder.exportWAV(function(blob) {
            var url = URL.createObjectURL(blob)
            var hf = $('<a>', {
                href: url,
                class: 'downloadRec',
                download: new Date().toISOString() + '.wav'
            }).html($('#recContainer .downloadRec').length + 1).appendTo('#recContainer')
        })
    }
    
})

},{"./Track":1,"./TrackView":2,"./globals":3,"./soundSources":5}],5:[function(require,module,exports){
var EventEmitter = require('events').EventEmitter
var globals = require('./globals')
var emitter = new EventEmitter()

class SoundSourceView {
    
    constructor(root) {
        SoundSourceView.all.push(this)
        this.root = root
        this.root.find('form').submit(this._onSubmit.bind(this))
    }
    
    search(q, done) {}
    resultClicked() {}
    
    _onSubmit(event) {
        event.preventDefault()
        this.root.addClass('searching')
        this.search(this.root.find('input[type=text]').val(), this._onResults.bind(this))
    }

    _onResults(results) {
        var searchResultsUl = this.root.find('ul.searchResults')
        this.root.removeClass('searching')
        searchResultsUl.empty()
        results.forEach((r) => {
            $('<li>', { class: 'searchResult' }).html(r.display).appendTo(searchResultsUl)
                .click(this.resultClicked.bind(this, r))
        })
    }
}

SoundSourceView.all = []

// SoundCloud source 
class SoundCloudSourceView extends SoundSourceView {
    
    search(q, done) {
        SC.get('/tracks', {limit: 10, q: q}, (results) => {
            done(results.map((r) => {
                return {
                    display: r.user.username + ' - ' + r.title,
                    url: r.stream_url + '?client_id=' + globals.scToken
                }
            }))
        })
    }
    
    resultClicked(result) {
        emitter.emit('selected', result)
    } 
    
}

// freesound.org source
class FreeSoundSourceView extends SoundSourceView {
    
    search(q, done) {
        var url = 'http://freesound.org/apiv2/search/text/?token=' + globals.fsToken + '&query=' + q
        $.getJSON(url, (results) => {
            done(results.results.map((r) => {
                return {
                    display: r.username + ' - ' + r.name,
                    url: 'http://freesound.org/apiv2/sounds/' + r.id + '/?token=' + globals.fsToken
                }
            }))
        })
    }
    
    resultClicked(result) {
        $.getJSON(result.url, (r) => {
            emitter.emit('selected', r.download + '?token=' + globals.fsToken, result.display)
        })
    }
    
}

module.exports = {
    SoundCloudSourceView: SoundCloudSourceView,
    FreeSoundSourceView: FreeSoundSourceView,
    emitter: emitter,
}
},{"./globals":3,"events":7}],6:[function(require,module,exports){
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
},{}],7:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var objectCreate = Object.create || objectCreatePolyfill
var objectKeys = Object.keys || objectKeysPolyfill
var bind = Function.prototype.bind || functionBindPolyfill

function EventEmitter() {
  if (!this._events || !Object.prototype.hasOwnProperty.call(this, '_events')) {
    this._events = objectCreate(null);
    this._eventsCount = 0;
  }

  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
var defaultMaxListeners = 10;

var hasDefineProperty;
try {
  var o = {};
  if (Object.defineProperty) Object.defineProperty(o, 'x', { value: 0 });
  hasDefineProperty = o.x === 0;
} catch (err) { hasDefineProperty = false }
if (hasDefineProperty) {
  Object.defineProperty(EventEmitter, 'defaultMaxListeners', {
    enumerable: true,
    get: function() {
      return defaultMaxListeners;
    },
    set: function(arg) {
      // check whether the input is a positive number (whose value is zero or
      // greater and not a NaN).
      if (typeof arg !== 'number' || arg < 0 || arg !== arg)
        throw new TypeError('"defaultMaxListeners" must be a positive number');
      defaultMaxListeners = arg;
    }
  });
} else {
  EventEmitter.defaultMaxListeners = defaultMaxListeners;
}

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function setMaxListeners(n) {
  if (typeof n !== 'number' || n < 0 || isNaN(n))
    throw new TypeError('"n" argument must be a positive number');
  this._maxListeners = n;
  return this;
};

function $getMaxListeners(that) {
  if (that._maxListeners === undefined)
    return EventEmitter.defaultMaxListeners;
  return that._maxListeners;
}

EventEmitter.prototype.getMaxListeners = function getMaxListeners() {
  return $getMaxListeners(this);
};

// These standalone emit* functions are used to optimize calling of event
// handlers for fast cases because emit() itself often has a variable number of
// arguments and can be deoptimized because of that. These functions always have
// the same number of arguments and thus do not get deoptimized, so the code
// inside them can execute faster.
function emitNone(handler, isFn, self) {
  if (isFn)
    handler.call(self);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self);
  }
}
function emitOne(handler, isFn, self, arg1) {
  if (isFn)
    handler.call(self, arg1);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self, arg1);
  }
}
function emitTwo(handler, isFn, self, arg1, arg2) {
  if (isFn)
    handler.call(self, arg1, arg2);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self, arg1, arg2);
  }
}
function emitThree(handler, isFn, self, arg1, arg2, arg3) {
  if (isFn)
    handler.call(self, arg1, arg2, arg3);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self, arg1, arg2, arg3);
  }
}

function emitMany(handler, isFn, self, args) {
  if (isFn)
    handler.apply(self, args);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].apply(self, args);
  }
}

EventEmitter.prototype.emit = function emit(type) {
  var er, handler, len, args, i, events;
  var doError = (type === 'error');

  events = this._events;
  if (events)
    doError = (doError && events.error == null);
  else if (!doError)
    return false;

  // If there is no 'error' event listener then throw.
  if (doError) {
    if (arguments.length > 1)
      er = arguments[1];
    if (er instanceof Error) {
      throw er; // Unhandled 'error' event
    } else {
      // At least give some kind of context to the user
      var err = new Error('Unhandled "error" event. (' + er + ')');
      err.context = er;
      throw err;
    }
    return false;
  }

  handler = events[type];

  if (!handler)
    return false;

  var isFn = typeof handler === 'function';
  len = arguments.length;
  switch (len) {
      // fast cases
    case 1:
      emitNone(handler, isFn, this);
      break;
    case 2:
      emitOne(handler, isFn, this, arguments[1]);
      break;
    case 3:
      emitTwo(handler, isFn, this, arguments[1], arguments[2]);
      break;
    case 4:
      emitThree(handler, isFn, this, arguments[1], arguments[2], arguments[3]);
      break;
      // slower
    default:
      args = new Array(len - 1);
      for (i = 1; i < len; i++)
        args[i - 1] = arguments[i];
      emitMany(handler, isFn, this, args);
  }

  return true;
};

function _addListener(target, type, listener, prepend) {
  var m;
  var events;
  var existing;

  if (typeof listener !== 'function')
    throw new TypeError('"listener" argument must be a function');

  events = target._events;
  if (!events) {
    events = target._events = objectCreate(null);
    target._eventsCount = 0;
  } else {
    // To avoid recursion in the case that type === "newListener"! Before
    // adding it to the listeners, first emit "newListener".
    if (events.newListener) {
      target.emit('newListener', type,
          listener.listener ? listener.listener : listener);

      // Re-assign `events` because a newListener handler could have caused the
      // this._events to be assigned to a new object
      events = target._events;
    }
    existing = events[type];
  }

  if (!existing) {
    // Optimize the case of one listener. Don't need the extra array object.
    existing = events[type] = listener;
    ++target._eventsCount;
  } else {
    if (typeof existing === 'function') {
      // Adding the second element, need to change to array.
      existing = events[type] =
          prepend ? [listener, existing] : [existing, listener];
    } else {
      // If we've already got an array, just append.
      if (prepend) {
        existing.unshift(listener);
      } else {
        existing.push(listener);
      }
    }

    // Check for listener leak
    if (!existing.warned) {
      m = $getMaxListeners(target);
      if (m && m > 0 && existing.length > m) {
        existing.warned = true;
        var w = new Error('Possible EventEmitter memory leak detected. ' +
            existing.length + ' "' + String(type) + '" listeners ' +
            'added. Use emitter.setMaxListeners() to ' +
            'increase limit.');
        w.name = 'MaxListenersExceededWarning';
        w.emitter = target;
        w.type = type;
        w.count = existing.length;
        if (typeof console === 'object' && console.warn) {
          console.warn('%s: %s', w.name, w.message);
        }
      }
    }
  }

  return target;
}

EventEmitter.prototype.addListener = function addListener(type, listener) {
  return _addListener(this, type, listener, false);
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.prependListener =
    function prependListener(type, listener) {
      return _addListener(this, type, listener, true);
    };

function onceWrapper() {
  if (!this.fired) {
    this.target.removeListener(this.type, this.wrapFn);
    this.fired = true;
    switch (arguments.length) {
      case 0:
        return this.listener.call(this.target);
      case 1:
        return this.listener.call(this.target, arguments[0]);
      case 2:
        return this.listener.call(this.target, arguments[0], arguments[1]);
      case 3:
        return this.listener.call(this.target, arguments[0], arguments[1],
            arguments[2]);
      default:
        var args = new Array(arguments.length);
        for (var i = 0; i < args.length; ++i)
          args[i] = arguments[i];
        this.listener.apply(this.target, args);
    }
  }
}

function _onceWrap(target, type, listener) {
  var state = { fired: false, wrapFn: undefined, target: target, type: type, listener: listener };
  var wrapped = bind.call(onceWrapper, state);
  wrapped.listener = listener;
  state.wrapFn = wrapped;
  return wrapped;
}

EventEmitter.prototype.once = function once(type, listener) {
  if (typeof listener !== 'function')
    throw new TypeError('"listener" argument must be a function');
  this.on(type, _onceWrap(this, type, listener));
  return this;
};

EventEmitter.prototype.prependOnceListener =
    function prependOnceListener(type, listener) {
      if (typeof listener !== 'function')
        throw new TypeError('"listener" argument must be a function');
      this.prependListener(type, _onceWrap(this, type, listener));
      return this;
    };

// Emits a 'removeListener' event if and only if the listener was removed.
EventEmitter.prototype.removeListener =
    function removeListener(type, listener) {
      var list, events, position, i, originalListener;

      if (typeof listener !== 'function')
        throw new TypeError('"listener" argument must be a function');

      events = this._events;
      if (!events)
        return this;

      list = events[type];
      if (!list)
        return this;

      if (list === listener || list.listener === listener) {
        if (--this._eventsCount === 0)
          this._events = objectCreate(null);
        else {
          delete events[type];
          if (events.removeListener)
            this.emit('removeListener', type, list.listener || listener);
        }
      } else if (typeof list !== 'function') {
        position = -1;

        for (i = list.length - 1; i >= 0; i--) {
          if (list[i] === listener || list[i].listener === listener) {
            originalListener = list[i].listener;
            position = i;
            break;
          }
        }

        if (position < 0)
          return this;

        if (position === 0)
          list.shift();
        else
          spliceOne(list, position);

        if (list.length === 1)
          events[type] = list[0];

        if (events.removeListener)
          this.emit('removeListener', type, originalListener || listener);
      }

      return this;
    };

EventEmitter.prototype.removeAllListeners =
    function removeAllListeners(type) {
      var listeners, events, i;

      events = this._events;
      if (!events)
        return this;

      // not listening for removeListener, no need to emit
      if (!events.removeListener) {
        if (arguments.length === 0) {
          this._events = objectCreate(null);
          this._eventsCount = 0;
        } else if (events[type]) {
          if (--this._eventsCount === 0)
            this._events = objectCreate(null);
          else
            delete events[type];
        }
        return this;
      }

      // emit removeListener for all listeners on all events
      if (arguments.length === 0) {
        var keys = objectKeys(events);
        var key;
        for (i = 0; i < keys.length; ++i) {
          key = keys[i];
          if (key === 'removeListener') continue;
          this.removeAllListeners(key);
        }
        this.removeAllListeners('removeListener');
        this._events = objectCreate(null);
        this._eventsCount = 0;
        return this;
      }

      listeners = events[type];

      if (typeof listeners === 'function') {
        this.removeListener(type, listeners);
      } else if (listeners) {
        // LIFO order
        for (i = listeners.length - 1; i >= 0; i--) {
          this.removeListener(type, listeners[i]);
        }
      }

      return this;
    };

function _listeners(target, type, unwrap) {
  var events = target._events;

  if (!events)
    return [];

  var evlistener = events[type];
  if (!evlistener)
    return [];

  if (typeof evlistener === 'function')
    return unwrap ? [evlistener.listener || evlistener] : [evlistener];

  return unwrap ? unwrapListeners(evlistener) : arrayClone(evlistener, evlistener.length);
}

EventEmitter.prototype.listeners = function listeners(type) {
  return _listeners(this, type, true);
};

EventEmitter.prototype.rawListeners = function rawListeners(type) {
  return _listeners(this, type, false);
};

EventEmitter.listenerCount = function(emitter, type) {
  if (typeof emitter.listenerCount === 'function') {
    return emitter.listenerCount(type);
  } else {
    return listenerCount.call(emitter, type);
  }
};

EventEmitter.prototype.listenerCount = listenerCount;
function listenerCount(type) {
  var events = this._events;

  if (events) {
    var evlistener = events[type];

    if (typeof evlistener === 'function') {
      return 1;
    } else if (evlistener) {
      return evlistener.length;
    }
  }

  return 0;
}

EventEmitter.prototype.eventNames = function eventNames() {
  return this._eventsCount > 0 ? Reflect.ownKeys(this._events) : [];
};

// About 1.5x faster than the two-arg version of Array#splice().
function spliceOne(list, index) {
  for (var i = index, k = i + 1, n = list.length; k < n; i += 1, k += 1)
    list[i] = list[k];
  list.pop();
}

function arrayClone(arr, n) {
  var copy = new Array(n);
  for (var i = 0; i < n; ++i)
    copy[i] = arr[i];
  return copy;
}

function unwrapListeners(arr) {
  var ret = new Array(arr.length);
  for (var i = 0; i < ret.length; ++i) {
    ret[i] = arr[i].listener || arr[i];
  }
  return ret;
}

function objectCreatePolyfill(proto) {
  var F = function() {};
  F.prototype = proto;
  return new F;
}
function objectKeysPolyfill(obj) {
  var keys = [];
  for (var k in obj) if (Object.prototype.hasOwnProperty.call(obj, k)) {
    keys.push(k);
  }
  return k;
}
function functionBindPolyfill(context) {
  var fn = this;
  return function () {
    return fn.apply(context, arguments);
  };
}

},{}]},{},[4]);
