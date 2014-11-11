var EventEmitter = require('events').EventEmitter
  , inherits = require('util').inherits
  , globals = require('./globals')

exports.emitter = new EventEmitter()

var SoundSourceView = function(root) {
  SoundSourceView.all.push(this)
  var self = this
    , searchResultsUl = root.find('ul.searchResults')
  this.root = root

  this.root.find('form').submit(function(event) {
    event.preventDefault()
    root.addClass('searching')
    self.search(root.find('input[type=text]').val(), function(results) {
      root.removeClass('searching')
      searchResultsUl.empty()
      results.forEach(function(r) {
        $('<li>', { class: 'searchResult' }).html(r.display).appendTo(searchResultsUl)
          .click(self.resultClicked.bind(self, r))
      })
    })
  })
}

SoundSourceView.prototype.search = function(q, done) {}
SoundSourceView.prototype.resultClicked = function() {}
SoundSourceView.all = []

// SoundCloud source 
var SoundCloudSourceView = module.exports.SoundCloudSourceView = function(root) {
  SoundSourceView.apply(this, arguments)
}
inherits(SoundCloudSourceView, SoundSourceView)

SoundCloudSourceView.prototype.search = function(q, done) {
  SC.get('/tracks', {limit: 10, q: q}, function(results) {
    done(results.map(function(r) {
      return {
        display: r.user.username + ' - ' + r.title,
        url: r.stream_url + '?client_id=' + globals.scToken
      }
    }))
  })
}

SoundCloudSourceView.prototype.resultClicked = function(result) {
  exports.emitter.emit('selected', result)
} 

// freesound.org source
var FreeSoundSourceView = module.exports.FreeSoundSourceView = function(root) {
  SoundSourceView.apply(this, arguments)
}
inherits(FreeSoundSourceView, SoundSourceView)

FreeSoundSourceView.prototype.search = function(q, done) {
  var url = 'http://freesound.org/apiv2/search/text/?token=' + globals.fsToken + '&query=' + q
  $.getJSON(url, function(results) {
    done(results.results.map(function(r) {
      return {
        display: r.username + ' - ' + r.name,
        url: 'http://freesound.org/apiv2/sounds/' + r.id + '/?token=' + globals.fsToken
      }
    }))
  })
}

FreeSoundSourceView.prototype.resultClicked = function(result) {
  $.getJSON(result.url, function(r) {
    exports.emitter.emit('selected', r.download + '?token=' + globals.fsToken, result.display)
  })
}