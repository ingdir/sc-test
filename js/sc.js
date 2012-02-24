$(function() {
    
    // empty wrappers for console.log methods
    if (window.console === undefined) {
        window.console = {
            log: $.noop,
            dir: $.noop,
            warn: $.noop
        };
    }
    
    var client_id = '3c392172a12b1eec82784e86ce258959';
    
    // modified version of J.Resig's Microtemplating engine
    // with HTML-safe interpolation {%= htmlSafe %}
    // and "classic" {%~ classic %}
    var cache = {};
    function tmpl(str, data) {
        var fn = !/\W/.test(str) ?
            cache[str] = cache[str] ||
            tmpl(document.getElementById(str).innerHTML) :

            new Function('obj',
                'var p=[],print=function(){p.push.apply(p,arguments);};'
              + "with(obj){p.push('"
              + str
                    .replace(/[\r\t\n]/g, ' ')
                    .split('{%').join('\t')
                    .replace(/((^|%\})[^\t]*)'/g, '$1\r')
                    .replace(/\t~(.*?)%\}/g, "',$1,'")
                    .replace(/\t=(.*?)%\}/g,
                        "',(($1)+'')" +
                        ".replace(/\\&/g, '&amp;')" +
                        ".replace(/</g, '&lt;')" +
                        ".replace(/>/g, '&gt;')" +
                        ".replace(/\"/g, '&quot;'),'")
                    .split('\t').join("');")
                    .split('%}').join("p.push('")
                    .split('\r').join("\\'")
              + "');}return p.join('');");
            
        return data ? fn(data) : fn;
    }
    // end microtemplating

    // unique id generator
    function generateId() {
        generateId.id === undefined ? (generateId.id = 1) : ++generateId.id;
        return (+new Date) + '' + generateId.id;
    }
    
    var $this = $('.b-sc').eq(0),
        // singleton: playlist container
        plContainer = new PlaylistContainer(),
        // singleton: HTML 5 audio player
        player = new Player(),
        // singleton: storage
        storage = new Storage(),
        $form = $this.find('.b-sc__search-form'),
        $query = $this.find('.b-sc__search-query'),
        playlistOpen = false,
        noTitle = 'No title',
        noDesc = 'no description';
        
    // create playlist container, we need it anyway
    plContainer.renderTo($this);
    
    // restore stored playlist data
    storage.restoreState();
    storage.saveState();
    
    $query.focus();
    
    // bookmarklet processing
    // http://shirshin.com/sc/#1234567
    var h = window.location.hash.substr(1),
        hId = parseInt(h, 10);
        
    if (!isNaN(hId)) {
        getTrackById(hId, function(data) {
            displaySearchResults([data]);
            window.location.hash = '';
        });
    }
    // handlers

    $form
        .submit(function(e) {  // search handler
            e.preventDefault();
            
            var q = $.trim($query.val()),
                reqParams = {
                    limit: 10,
                    client_id: client_id
                };
                
            if (q != '') {
                reqParams.q = q;
            }
            
            $.getJSON('http://api.soundcloud.com/tracks.json?callback=?', reqParams, function(data) {
                displaySearchResults(data);
                
                // surprise! :-)
                if (reqParams.q.toLowerCase() === '\u006C\u006F\u0076\u0065') {
                    $this.find('.b-sc__add-label').css({backgroundColor: 'pink', color: 'red'}).text('\u2665 Add to \u2665');
                }
            });
        })
        .delegate('.b-sc__add-label', 'click', function(e) {  // drop-down menu
            var $this = $(this),
                dataId = $this.attr('data-id');
            
            if (playlistOpen === dataId) {
                return true;
            }
            
            e.stopPropagation();
            $('body').triggerHandler('closePlaylistPopup');
            
            playlistOpen = dataId;
            
            var $pl = $this.closest('.b-sc__playlist-selector').find('.b-sc__all-playlists');
            $pl.empty();
            
            $pl.append(tmpl('pl', {
                id: '',
                title: '...new playlist'
            }));
            
            $.each(plContainer.playlists, function(i, el) {
                $pl.append(tmpl('pl', el));
            });
            
            $pl.show();
        })
        .delegate('.b-sc__pl', 'click', function(e) {  // drop-down menu of playlists
            var playlistId = $(this).attr('data-id'),
                trackId = $(this).closest('.b-sc__found').attr('data-id');
                
            getTrackById(trackId, function(data) {
                var playlist;
                // if a new playlist is requested, add it first...
                if (playlistId === '') {
                    playlist = new Playlist({
                        title: 'Playlist ' + (plContainer.playlists.length + 1),
                        desc: noDesc
                    });
                    
                    plContainer.add(playlist);
                } else {
                    // otherwise, use the existing one
                    playlist = plContainer.get(playlistId);
                }
                
                // adding the track chosen by a user
                playlist.add(new Track({
                    name: data.title || noTitle,
                    desc: data.description || noDesc,
                    id: data.id,
                    stream_url: data.stream_url,
                    download_url: data.download_url
                }));
                
                // save this in the undo history
                storage.saveState();
            });
            
        });
        
    // this handler is necessary to close the playlist popup menu
    $('body').bind('click closePlaylistPopup', function() {
        playlistOpen && $(this).find('.b-sc__all-playlists').hide();
        playlistOpen = false;
    });

    // undo btn handler
    $this.find('.b-sc__undo').click(function() {
        storage.undoState();
    });

    $this
        .find('.b-sc__volplus')
            .click(function() {
                player.volumeInc();  // volume increase
            })
        .end()
        .find('.b-sc__volminus')
            .click(function() {
                player.volumeDec();  // colume descrease
            })
        .end()
        .delegate('.b-sc__tremove', 'click', function(e) {  // track removal
            var $this = $(this),
                trackId = $this.closest('.b-sc__track').attr('data-id'),
                playlistId = $this.closest('.b-sc__playlist').attr('data-id');
                
            plContainer.get(playlistId).remove(trackId);
            storage.saveState();
        })
        .delegate('.b-sc__premove', 'click', function(e) {  // playlist removal
            var playlistId = $(e.target).closest('.b-sc__playlist').attr('data-id');
            plContainer.remove(playlistId);
            storage.saveState();
        })
        .delegate('.b-sc__tplay', 'click', function(e) {  // play track
            var $this = $(this),
                trackId = $this.closest('.b-sc__track').attr('data-id'),
                playlistId = $this.closest('.b-sc__playlist').attr('data-id');
                
            player.play(plContainer.get(playlistId).get(trackId));
        })
        .delegate('.b-sc__pplay', 'click', function(e) {  // play the whole playlist
            var playlistId = $(this).closest('.b-sc__playlist').attr('data-id'),
                track = plContainer.get(playlistId).tracks[0];
                
            if (track) player.play(track);
        })
        .delegate('.b-sc__ppause, .b-sc__tpause', 'click', function() {  // pause (either track or playlist)
            player.pause();
        })
        .delegate('.b-sc__edit-label', 'click', function(e) {  // edit playlist title or description
            var $this = $(this),
                type = $this.attr('data-type'),
                $pl = $this.closest('.b-sc__playlist'),
                $editor = $pl.find('.b-sc__' + type + '-editor');
            
            $this.closest('.b-sc__' + type).hide();
            $editor
                .show()
                .find('.b-sc__input')
                    .val(plContainer.get($pl.attr('data-id'))[type])
                    .focus()
                    .select();
        })
        .delegate('.b-sc__title-editor, .b-sc__desc-editor', 'submit', function(e) {
            // avoid real form submission;
            // the reason we use a form is to provide automatic handling of Enter button
            e.preventDefault();
            
            var $this = $(this),
                type = $this.attr('data-type'),
                newName = $this.find('.b-sc__input').val(),
                $pl = $this.closest('.b-sc__playlist'),
                update = {};
                
            // replace empty names with textual shortcuts
            if (/^\s*$/.test(newName)) {
                newName = type === 'title' ? noTitle : noDesc;
            }
            
            $this.hide();
            update[type] = newName;
            plContainer.get($pl.attr('data-id')).update(update);
            $pl.find('.b-sc__' + type + '-txt').text(newName);
            $pl.find('.b-sc__' + type).show();
            
            storage.saveState();
        });
    
    // object helpers
    
    // data storage API, the simplest one
    function Storage() {
        return {
            states: [],
            maxUndoSteps: 100,
            $undo: $this.find('.b-sc__undo'),
            
            updateUndo: function() {
                if (this.states.length <= 1) {
                    this.$undo.attr('disabled', 'disabled');
                } else {
                    this.$undo.removeAttr('disabled');
                }
            },
            
            get: function(key) {
                return window.localStorage.getItem(key);
            },
            
            set: function(key, value) {
                window.localStorage.setItem(key, value);
            },
            
            saveState: function() {
                var state = JSON.stringify(plContainer.save());
                this.set('sc', state);
                
                this.states.push(state);
                if (this.states.length > this.maxUndoSteps) this.states.shift();
                
                this.updateUndo();
            },
            
            undoState: function() {
                if (this.states.length > 1) {
                    this.states.pop();
                    this.restoreState(this.states[this.states.length - 1]);
                }
                
                this.updateUndo();
            },
            
            restoreState: function(str) {
                var data = JSON.parse(str || this.get('sc')) || [];
                
                player.pause();
                plContainer.$dom.remove();
                plContainer = new PlaylistContainer();
                plContainer.renderTo($this);
                
                $.each(data, function(i, plist) {
                    var playlist = new Playlist(plist);
                    plContainer.add(playlist);
                    
                    $.each(plist.tracks, function(i, trk) {
                        playlist.add(new Track(trk));
                    });
                });
                
                this.updateUndo();
            }
        };
    }

    
    // HTML5 ausio player
    function Player() {
        var p = new Audio(),
            that = this;
        
        this.nowPlaying = null;
        this.play = function(track) {
            if (!track || (!track.stream_url && !track.download_url)) {
                return true;
            };
            
            clearNowPlaying();
            track.$dom.addClass('b-sc__track_playing');
            
            p.pause();
            p.setAttribute('src', (track.stream_url || track.download_url) + '?client_id=' + client_id);
            this.nowPlaying = track;
            p.play();
        };
        
        this.pause = function() {
            clearNowPlaying();
            p.setAttribute('src', '');
            p.pause();
        };
        
        this.volumeInc = function() {
            p.volume += p.volume <= 0.9 ? 0.1 : 0;
        };
        
        this.volumeDec = function() {
            p.volume -= p.volume >= 0.1 ? 0.1 : 0;
        };

        p.addEventListener('ended', function() {
            if (that.nowPlaying) {
                var next = that.nowPlaying.playlist.nextFrom(that.nowPlaying);
                that.play(next);
            }
        });
        
        function clearNowPlaying() {
            plContainer.$dom.find('.b-sc__track_playing').removeClass('b-sc__track_playing');
        }

    }
    
    // this object represents the entire playlist collection
    function PlaylistContainer() {
        this.playlists = [];

        this.save = function() {
            var obj = [];
            
            $.each(this.playlists, function(i, el) {
                obj.push(el.save());
            });
            return obj;
        };
        
        this.renderTo = function(elem) {
            this.$dom = $(tmpl('playlistContainer', {}));
            $(elem).append(this.$dom);
        };
        
        this.add = function(playlist) {
            this.playlists.push(playlist);
            playlist.renderTo(this.$dom);
        };
        
        this.remove = function(playlistId) {
            var condemned = this.get(playlistId);
            if (condemned) {

                if (player.nowPlaying && condemned.get(player.nowPlaying.id)) {
                    player.pause();
                }

                this.playlists.splice(condemned.arrayIndex, 1);
                condemned.$dom.remove();
            }
            return condemned;
        };
        
        this.get = function(id) {
            var result = null,
                playlists = this.playlists;
            
            $.each(playlists, function(i) {
                if (this.id == id) {
                    result = playlists[i];
                    result.arrayIndex = i;
                    return false;
                }
            });
            
            return result;
        };
    }
    
    // playlist object constructor
    function Playlist(param) {
        this.tracks = [];
        this.id = param.id || generateId();
        this.title = param.title;
        this.desc = param.desc;

        this.save = function() {
            var obj = {
                id: this.id,
                title: this.title,
                desc: this.desc
            };
            
            obj.tracks = [];
            $.each(this.tracks, function(i, el) {
                obj.tracks.push(el.save());
            });
            
            return obj;
        };
        
        this.renderTo = function(elem) {
            this.$dom = $(tmpl('playlist', this));
            $(elem).append(this.$dom);
        };
        
        this.add = function(track) {
            if (this.get(track.id)) {
                // we do NOT allow duplicate tracks in the same playlist
                return true;
            }
            
            this.tracks.push(track);
            track.playlist = this;
            track.renderTo(this.$dom.find('.b-sc__tracklist'));
        };
        
        this.get = function(trackId) {
            var result = null,
                tracks = this.tracks;
            
            $.each(this.tracks, function(i, el) {
                if (el.id == trackId) {
                    result = tracks[i];
                    result.arrayIndex = i;
                    return false;
                }
            });
            
            return result;
        };
        
        // find the next track to play
        this.nextFrom = function(track) {
            var thisTrack = this.get(track.id),
                i = -1;
            
            if (thisTrack) {
                i = thisTrack.arrayIndex;
            }
            
            if (this.tracks[i + 1]) {
                return this.tracks[i + 1];
            } else if (this.tracks[0]) {
                return this.tracks[0];
            } else return null;
        };
        
        this.remove = function(trackId) {
            var track = this.get(trackId),
                result = null;

            if (track) {
                this.tracks.splice(track.arrayIndex, 1);
                if (player.nowPlaying && track.id == player.nowPlaying.id && this.id == player.nowPlaying.playlist.id) {
                    player.pause();
                }
                
                track.$dom.remove();
                track.playlist = null;
                result = track;
            }
            
            return result;
        };
        
        // update title and/or description of a playlist
        this.update = function(param) {
            if (param.title !== undefined) {
                this.title = param.title;
                this.$dom.find('.b-sc__ptitle').text(this.title);
            }

            if (param.desc !== undefined) {
                this.desc = param.desc;
                this.$dom.find('.b-sc__pdesc').text(this.desc);
            }
        };
    }

    // track obj constructor
    function Track(param) {
        this.name = param.name || 'NONAME';
        this.desc = param.desc || '';
        this.id = param.id || generateId();
        this.stream_url = param.stream_url || null;
        this.download_url = param.download_url || null;
        this.playlist = null;
        
        this.save = function() {
            return {
                name: this.name,
                desc: this.desc,
                id: this.id,
                stream_url: this.stream_url,
                download_url: this.download_url
            };
        };
        
        this.renderTo = function(elem) {
            this.$dom = $(tmpl('track', this));
            $(elem).append(this.$dom);
        };
        
    }
    
    // end object helpers

    // SoundCloud API
    
    function getTrackById(id, callback) {
        // init cache
        getTrackById.cache = getTrackById.cache || {};

        if (getTrackById.cache[id]) {
            callback(getTrackById.cache[id]);
        } else {
            $.getJSON('http://api.soundcloud.com/tracks/' + id + '.json?callback=?', {
                client_id: client_id
            }, function(data) {
                getTrackById.cache[id] = data;
                callback(data);
            });
        }
    }
    // drop the cache every 15 minutes
    setInterval(function() {
        getTrackById.cache = {};
    }, 1000 * 60 * 15);
    
    // end SoundCloud API
    
    // helpers
    function displaySearchResults(data) {
        var $results = $this.find('.b-sc__results');
        
        $results.empty();
        
        if (data.length == 0) {
            $results.text('Nothing found!');
        }
        
        $.each(data, function(i, el) {
            $results.append(tmpl('found', el));
        });
    }

});