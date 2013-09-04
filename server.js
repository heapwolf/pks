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
var ip = require('ip')

var replicate = require('./replicate')

var configpath = path.join(process.cwd(), '.pkp.json')
var config
var peer
var pair // a public and private key pair

var opts = { createIfMissing: true, valueEncoding: 'json' }
var db = sublevel(level('./db', opts))

hooks(db)

var header = '-----BEGIN RSA PUBLIC KEY-----\n'
var footer = '\n-----END RSA PUBLIC KEY-----\n\n'

function prepKey(key) {
  return key.replace(header, '').replace(footer, '')
}

var endkey = 'END RSA PUBLIC KEY~'

db.pre({ start: '', end: endkey }, function (change, add) {

  if (change.type === 'put') {
    add({
      type: 'put',
      key: ['index', mts(), keyhash(change.key)].join('-'),
      value: change.key
    })
  }
})

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
    'ERR: Couldn\'t find public and private key in %s.', configpath
  )
  process.exit(1)
}

function keyhash(s) {

  return crypto.createHash('sha1').update(new Buffer(s)).digest('hex')
}

function checkSeed() {

  var key = prepKey(pair.public)

  db.get(key, function(err, data) {

    if (!err && data) {
      return preStart()
    }

    var cert = {
      'address-at': config['address-at'],
      'servers-at': config['servers-at'],
      'public': config.public
    }

    db.put(key, cert, function(err) {
      if (err) {
        return console.log(err)
      }
      preStart()
    })
  })
}

function preStart() {

  db.get('servers', function(err, data) {
    if (data) {
      allservers = data
    }
    start()
  })
}

function start() {

  replicate(pair, allservers, recentservers, db)

  var server = net.createServer(function (con) {

    var cert
    var sec

    sec = peer(function (s) {
      
      var auth = {
        access: function (_null, db, method, args) {

          if ( cert && method === 'put' ||
               !cert && method === 'get' ||
               !cert && method === 'createReadStream' ) {

            var log = {
              message: 'A ' + method + ' was allowed',
              args: args
            }
            console.log(log)
            return true
          }

          var log = {
            message: 'An attempt to ' + method + ' was denied.',
            args: args
          }
          console.log(log)
          s.end()
        }
      }

      s.pipe(multilevel.server(db, auth)).pipe(s)
    })

    sec.on('identify', function (id) {

      db.get(prepKey(id.key.public), function(err, value) {

        if (!err) {
          if (id.key.public === value.public) {
            cert = value
          }
        }
        id.accept()
      })
    })

    sec.pipe(con).pipe(sec)
  })

  server.on('error', function(e) {
    console.log(e)
  })
  
  server.listen(11372, function() {
    console.log('Server started on port 11372')
  })
}
