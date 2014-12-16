/* jslint node: true */
'use strict';

var dns = require('dns');
var net = require('net');
var raw = require('raw-socket');

var packets = require('./packet');

// execute a traceroute
// options:
//   dest
//   timeout
//   interval
//   maxTTL
//   count
// callback

module.exports = function(options, cb) {
	if(net.isIP(options.dest) === 0) {
		dns.resolve4(options.dest, function(err, addresses) {
			if (err) {
				cb('cannot resolve host');
			} else {
				options.address = addresses[0];
				nTrace(options, cb);
			}
		});
	} else {
		options.address = options.dest;
		nTrace(options, cb);
	}
};

var i = 0;
function nTrace(options, cb) {
	if (++i < options.count) {
	  traceroute(options.address, options.timeout, options.interval, options.count || 4, options.maxTTL || 255, cb);
	}
}

function traceroute(dest, timeout, interval, count, maxTTL, cb, finCB) {
	var pass = 0;

  var trace = function() {
		var wrapper = require('./packet');
		wrapper.generate(3);
		var packet = wrapper.get();
		var sent_packets = [];
		var timeout_loop;

		var socket = raw.createSocket({ protocol: raw.Protocol.ICMP });
		var ttl_level = 1;

		// for each hop / ttl
		// FIXME: report timeout
		var loop = setInterval(function() {
			socket.setOption(raw.SocketLevel.IPPROTO_IP, raw.SocketOption.IP_TTL, ttl_level );
			wrapper.setTTL(ttl_level);

			socket.send(packet, 0, packet.length, dest, function(err, bytes) {
				if (err) {
					cb(err);
				}
			});

			sent_packets[ttl_level-1] = process.hrtime();

			if (ttl_level < maxTTL) ttl_level ++;
			else clearInterval(loop);
		}, interval);

		socket.on('message', function(buffer, source) {
	// get the position of the TTL
			var pos = checkMatch(buffer, packet.slice(5), buffer.length, packet.length-6);
			if (pos > 0) {
				var ttl = buffer[pos-1];
				if(ttl > 0 && (ttl-1) in sent_packets) {
					var time = process.hrtime(sent_packets[ttl-1]);
					cb(null, { pass: pass, hop: ttl-1, source: source, latency: (time[0]*1000+time[1]/1000/1000).toFixed(2)});

					clearTimeout(timeout_loop);
					timeout_loop = setTimeout(function() {
						end();
					}, timeout);

					if(source === dest) {
						end();
					}
				}

			}
		});
		function end() {
			clearInterval(loop);
			clearTimeout(timeout_loop);
			socket.close();
			if (pass++ < count) {
				trace();
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
