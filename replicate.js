var net = require('net')
var multilevel = require('multilevel')
var secure = require('secure-peer')

module.exports = function(pair, allservers, recentservers, localdb) {

  var M1 = 6e4

  function connect(server) {

    var remotedb = multilevel.client(manifest);

    var s = net.connect(server, 11372)
    var peer = secure(pair)

    var sec = peer(function (stream) {

      if (recentservers.length === 5) {
        recentservers.shift()
        recentservers.push(server)
      }

      setTimeout(function() {
        s.end()
      }, M1*2)

      stream.pipe(remotedb.createRpcStream()).pipe(stream)

      localdb.createReadStream({
        reverse: true,
        values: false,
        limit: 1
      }).on('data', function(key) {

        var lastUpdate = key.split('-')[1]

        function keepServers(cert) {

          var newservers = cert['servers-at']
          var len = newservers.length

          if (newservers && len) {
            
            localdb.get('servers', function(err, oldservers) {
              
              if (err) {
                console.log(err)
              }
              newservers.forEach(function(server) {
                if (oldservers.indexOf(server) > -1) {
                  oldservers.push(server)
                }
              })
              localdb.put('servers', oldservers, function(err) {
                if (err) {
                  console.log(err)
                }
                allservers = oldservers
              })
            })
          }
        }

        function resolve(key) {
          remotedb.get(key, function(err, cert) {
            if (err) { return console.log(err) }
            localdb.put(cert.public, cert, function(err) {
              if (!err) {
                keepServers(cert)
              }
            })
          })
        }

        remotedb
          .createReadStream({
            start: ['index-', lastUpdate + '~'].join('-'),
            keys: false
          })
          .on('data', resolve)
      })
    })

    sec.pipe(s).pipe(sec)
  }

  function randomServer() {
    var r = Math.random()*allservers.length
    return allservers[Math.floor(r)]
  }

  setInterval(function() {

    var server = randomServer()

    if (server) {
      connect(server)
    }
  }, M1*2)
}
