var net = require('net')
var path = require('path')
var fs = require('fs')
var crypto = require('crypto')

var level = require('level')
var multilevel = require('multilevel')
var sublevel = require('level-sublevel')
var secure = require('secure-peer')
var MuxDemux = require('mux-demux')
var Replicate = require('level-replicate')
var LiveStream = require('level-live-stream')
var ip = require('ip')

var replicate = require('./replicate')

var configpath = path.join(process.env['HOME'], '.pkp')
var config
var peer
var pair // a public and private key pair

function hash(key, opts) {
  opts = opts || {}
  alg = opts.algorithm || 'sha1'
  di = opts.digest || 'hex'
  var shasum = crypto.createHash(alg)
  return shasum.update(key).digest(di)
}

try {

  config = JSON.parse(fs.readFileSync(configpath, { encoding: 'utf8' }))

  pair = { 
    public: config.public,
    private: config.private
  }

  peer = secure(pair)

}
catch (ex) {

  console.log('ERR: Could not read public and private key, try `pkp config`.')
  process.exit(1)
}

var opts = { createIfMissing: true }
var db = sublevel(level('./db', opts))
var master = Replicate(db, 'master', ip.address())
var livestream = LiveStream.install(db)
var servers = []

db.createLiveStream().on('data', function(ch) {

  if (!ch.type || ch.type === 'put') {

    var cert = ch.value

    if (  cert.principal &&
          cert.principal['server-at'] &&
          servers.indexOf(cert.principal['server-at']) === -1 ) {

      servers.push(cert.principal['server-at'])
    }
  }
})

replicate(pair, servers, master)

net.createServer(function (con) {

  var key
  var cert
  var sec

  sec = peer(function (s) {

    var mdm = MuxDemux()
    var auth

    if (!cert) {
      
      auth = { 
        access: function (_null, db, method, args) {

          if (method !== 'get') {
            throw new Error('read-only')
          }
        }
      }
    }

    var m = master.createStream({ tail: true })
    var d = multilevel.server(db, auth)

    m.pipe(mdm.createStream('master')).pipe(m)
    d.pipe(mdm.createStream('rpc')).pipe(d)
    s.pipe(mdm).pipe(s)
  })

  sec.on('identify', function (id) {

    var offered = hash(id.key.public)

    db.get(offered, function(err, value) {

      if (!err) {

        var stored = hash(value.public, { algorithm: value.algorithm })

        if (stored === offered) {
          cert = stored
          key = stored.public
        }
      }
      id.accept()
    })
  })

  sec.pipe(con).pipe(sec)

}).listen(5000)
