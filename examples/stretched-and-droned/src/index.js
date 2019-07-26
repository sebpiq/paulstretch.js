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
    if (!window.AudioContext) {
        showModal('#noWebAudioAPIError')
        $('#createTrack').hide()
        $('#recContainer').hide()
        return
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
    // new soundSources.FreeSoundSourceView($('#freesoundSource'))
    
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
