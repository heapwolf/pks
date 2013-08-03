var net = require('net')
var secure = require('secure-peer')

module.exports = function(pair, servers, master) {

  var M1 = 6e4

  function connect(server) {

    var s = net.connect(server, 5000)
    var peer = secure(pair)

    var sec = peer(function (stream) {

      setTimeout(function() {
        s.end()
      }, M1*2)

      stream
        .pipe(master.createStream({ tail: true }))
        .pipe(stream)
    })

    sec.pipe(s).pipe(sec)
  }

  function randomServer() {
    var r = Math.random()*servers.length
    return servers[Math.floor(r)]
  }

  setInterval(function() {

    var server = randomServer()

    if (server) {
      connect(server)
    }
  }, M1*2)
}
