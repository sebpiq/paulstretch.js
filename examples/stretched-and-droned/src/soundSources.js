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