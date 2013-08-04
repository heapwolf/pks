var net = require('net')
var secure = require('secure-peer')

module.exports = function(pair, servers, recentservers, master) {

  var M1 = 6e4

  function connect(server) {

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

      stream
        .pipe(master.createStream({ tail: true }))
        .pipe(stream)
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
