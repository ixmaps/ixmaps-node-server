/* jslint node: true */
'use strict';

var dns = require('dns');
var net = require('net');

var raw = require('raw-socket'), packetFactory = require('./packet-factory');

// execute a traceroute
// options:
//   dest
//   timeout
//   interval
//   maxTTL
//   count
// callback

module.exports = function(options, cb, finCB) {
  if(!net.isIP(options.dest)) {
    dns.resolve4(options.dest, function(err, addresses) {
      if (err) {
        cb('cannot resolve host');
      } else {
        options.address = addresses[0];
        traceroute(options, cb, finCB);
      }
    });
  } else {
    options.address = options.dest;
    traceroute(options, cb, finCB);
  }
};

function traceroute(options, cb, finCB) {
  var pass = 0;

  var trace = function() {
    var sent_packets = [];
    var timeout_loop;

    var socket = raw.createSocket({ protocol: raw.Protocol.ICMP });
    var ttl_level = 1;
    var packet = packetFactory.create(3, ttl_level);

    // for each hop / ttl
    // FIXME: report timeout
    var loop = setInterval(function() {
      socket.setOption(raw.SocketLevel.IPPROTO_IP, raw.SocketOption.IP_TTL, ttl_level );

      socket.send(packet, 0, packet.length, options.address, function(err, bytes) {
        if (err) {
          cb(err);
        }
      });

      sent_packets[ttl_level-1] = process.hrtime();

      if (ttl_level < options.maxTTL) ttl_level ++;
      else clearInterval(loop);
    }, options.interval);

    socket.on('message', function(buffer, source) {
  // get the position of the TTL
      var pos = checkMatch(buffer, packet.slice(5), buffer.length, packet.length-6);
      if (pos > 0) {
        var ttl = buffer[pos-1];
        if (ttl > 0 && (ttl-1) in sent_packets) {
          var time = process.hrtime(sent_packets[ttl-1]);
          cb(null, { pass: pass, hop: ttl-1, source: source, latency: (time[0]*1000+time[1]/1000/1000).toFixed(2)});

          clearTimeout(timeout_loop);
          timeout_loop = setTimeout(function() {
            console.error('timed out');
            end();
          }, options.timeout);

          if (source === options.address) {
            end();
          }
        }

      }
    });
    function end() {
      clearInterval(loop);
      clearTimeout(timeout_loop);
      socket.close();
      if (++pass < options.count) {
        trace();
      } else {
        finCB();
      }
    }
  };
  trace();

}

// find the offset location
function checkMatch(buffer,sequence,blen,plen) {
  while (blen--) {
    if (buffer[blen] === sequence[plen]) {
      return (plen > 0) ? checkMatch(buffer, sequence, blen, plen-1) : blen;
    }
  }

  return 0;
}
