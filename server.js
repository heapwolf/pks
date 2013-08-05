var net = require('net')
var path = require('path')
var fs = require('fs')
var crypto = require('crypto')

var level = require('level')
var multilevel = require('multilevel')
var secure = require('secure-peer')
var sublevel = require('level-sublevel')
var hooks = require('level-hooks')
var mts = require('monotonic-timestamp')
var LiveStream = require('level-live-stream')
var ip = require('ip')

var replicate = require('./replicate')

var configpath = path.join(process.env['HOME'], '.pkp')
var config
var peer
var pair // a public and private key pair

var opts = { createIfMissing: true, valueEncoding: 'json' }
var db = sublevel(level('./db', opts))

hooks(db)

var end = 'END RSA PUBLIC KEY~'

db.pre({ start: '', end: end }, function (change, add) {

  if (change.type === 'put') {
    add({
      type: 'put',
      key: ['index', mts(), keyhash(change.key)].join('-'),
      value: change.key
    })
  }
})

var livestream = LiveStream.install(db)
var allservers = []
var recentservers = []

try {

  config = JSON.parse(
    fs.readFileSync(configpath, { encoding: 'utf8' })
  )

  pair = { 
    public: config.public,
    private: config.private
  }

  peer = secure(pair)
  console.log('Using configuration from %s', configpath)
  checkSeed()
}

catch (ex) {

  console.log(
    'ERR: Could not read public and private key, try `pkp config`.'
  )
  process.exit(1)
}

function keyhash(s) {

  return crypto.createHash('sha1').update(new Buffer(s)).digest('hex')
}

function checkSeed() {

  db.get(pair.public, function(err, data) {

    if (!err && data) {
      return preStart()
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
      preStart()
    })
  })
}

function preStart() {

  db.get('list-servers', function(err, data) {
    if (data) {
      allservers = data
    }
    start()
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
          }
        })
      }
    }
  })

  replicate(pair, allservers, recentservers, db)

  net.createServer(function (con) {

    var cert
    var sec

    sec = peer(function (s) {
      
      var auth = {
        access: function (_null, db, method, args) {

          if ( cert && method === 'put' ||
               !cert && method === 'get' ||
               !cert && method === 'createReadStream' ) {

            return true
          }
          throw new Error('method not allowed')
        }
      }

      s.pipe(multilevel.server(db, auth)).pipe(s)
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

  }).listen(11372, function() {
    console.log('Server started on port 11372')
  })
}
