var globals = require('./globals')
  , Track = require('./Track')
  , TrackView = require('./TrackView')
  , soundSources = require('./soundSources')

$(function() {
  nx.colorize("#009ee0")
  nx.colorize("border", "#272727")
  nx.colorize("fill", "#272727")

  globals.width = $(window).width()
  var trackViewsContainer = $('#trackViews')
    , tracks = []
    , maxTracks = 6

  var createTrack = function(url, display) {
    var audioSource = new Audio()
      , track
    audioSource.src = url
    track = {
      model: new Track(audioSource),
      view: trackView = new TrackView(trackViewsContainer, display)
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

  var hideModal = function() {
    $('.modal').fadeOut()
    $('#modalOverlay').fadeOut()    
  }

  var showModal = function(selector) {
    $('.modal').hide()
    $(selector).fadeIn()
    $('#modalOverlay').fadeIn()
  }

  $('#createTrack').click(function() {
    if (tracks.length < maxTracks) showModal('#soundSourcesModal')
    else showModal('#maxTracksReachedModal')
  })

  $('#modalOverlay').click(hideModal.bind(this, '#soundSourcesModal'))
  $('#showAbout').click(showModal.bind(this, '#aboutModal'))

  soundSources.emitter.on('selected', function(r) {
    createTrack(r.url, r.display)
    hideModal('#soundSourcesModal')
  })

  new soundSources.SoundCloudSourceView($('#soundCloudSource'))
  //new soundSources.FreeSoundSourceView($('#freesoundSource'))

})
SC.initialize({ client_id: globals.scToken })
