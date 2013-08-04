var net = require('net')
var path = require('path')
var fs = require('fs')

var level = require('level')
var multilevel = require('multilevel')
var secure = require('secure-peer')
var MuxDemux = require('mux-demux')
var Replicate = require('level-replicate')
var LiveStream = require('level-live-stream')

var replicate = require('./replicate')

var configpath = path.join(process.env['HOME'], '.pkp')
var config
var peer
var pair // a public and private key pair

var opts = { createIfMissing: true, valueEncoding: 'json' }
var db = level('./db', opts)
var master = Replicate(db, 'master', ip.address())
var livestream = LiveStream.install(db)
var allservers = []
var recentservers = []

try {

  config = JSON.parse(fs.readFileSync(configpath, { encoding: 'utf8' }))

  pair = { 
    public: config.public,
    private: config.private
  }

  peer = secure(pair)
  checkSeed()
}

catch (ex) {

  console.log('ERR: Could not read public and private key, try `pkp config`.', ex)
  process.exit(1)
}

function checkSeed() {

  db.get(pair.public, function(err, data) {

    if (!err && data) {
      return start()
    }

    var cert = {
      'address-at': config['address-at'],
      'servers-at': config['servers-at'],
      'public': config.public
    }

    db.put(config.public, cert, function(err) {
      if (err) {
        return console.log(err)
      }
      start()
    })
  })
}

function start() {

  db.createLiveStream().on('data', function(ch) {

    if (!ch.type || ch.type === 'put') {

      var cert = ch.value

      if (cert && cert['servers-at']) {

        cert['servers-at'].forEach(function(server) {

          if (allservers.indexOf(server) === -1 ) {
          allservers.push(server)
        })
      }
    }
  })

  replicate(pair, allservers, recentservers, master)

  net.createServer(function (con) {

    var cert
    var sec

    sec = peer(function (s) {

      var mdm = MuxDemux()
      
      var auth = {
        access: function (_null, db, method, args) {

          if ( cert && method === 'put' ||
               !cert && method === 'get' ) {
            return true
          }
          throw new Error('method not allowed')
        }
      }
      
      var m = master.createStream({ tail: true })
      var d = multilevel.server(db, auth)

      m.pipe(mdm.createStream('master')).pipe(m)
      d.pipe(mdm.createStream('rpc')).pipe(d)
      s.pipe(mdm).pipe(s)
    })

    sec.on('identify', function (id) {

      db.get(id.key.public, function(err, value) {

        if (!err) {
          if (id.key.public === value.public) {
            cert = value
          }
        }
        id.accept()
      })
    })

    sec.pipe(con).pipe(sec)

  }).listen(11372)
}
