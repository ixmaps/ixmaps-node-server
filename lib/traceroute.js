// /# traceroute
//
// Execute traceroutes one at a time.
//
// Adapted from https://github.com/jaw187/node-traceroute

/* jslint node: true */

'use strict';

var net   = require('net');
var dns   = require('dns');
var child = require('child_process');
var enabledPrograms = ['traceroute', 'tracert', 'paris-traceroute'];
var parser, isWin = (/^win/.test(require('os').platform())), traceCommand = 'traceroute', traceArgs = '-n -q ';

if (isWin) {
  traceCommand = 'tracert';
  traceArgs = '-d';
  parser = require('./parseWindows.js');
} else {
  parser = require('./parseNix.js');
}
var lastFound;

exports.trace = trace;
exports.rtt = rtt;

// execute a trace, call callback at the end.
// optionally call repCB as the results are received.
function trace(details, cb, reportCB) {
  lastFound = null;
  var host = details.domain, attempts = details.attempts;
  var command = safe(details.command || traceCommand) + attempts;
  var args = (details.args || traceArgs).split(' ');

  dns.lookup(host, function (err, address) {
    if (err && net.isIP(host) === 0) {
      cb(err);
    } else {
      details.dest_ip = Array.isArray(address) ? address[0] : address;
      args.push(details.dest_ip);

      var buf = '', spawned = child.spawn(command, args);
      spawned.stdout.on('data', function(data) {
        if (reportCB) {
          reportCB(null, { traceID: details.traceID, now: new Date(), host: host, data: data.toString(), buffer: buf, hops: parser.parse(buf, attempts)});
        }
        buf += data.toString();
      }).on('end', function(data) {
        cb(null, parser.parse(buf, attempts));
      }).on('error', function(error) {
        cb(error);
        if (reportCB) {
          reportCB(error);
        }
      });
    }
  });
}

// block text that's not safe for execFile
function safe(str, def) {
  return enabledPrograms.indexOf(str) > -1 ? str : def;
}

// encode an ip address and its round trip time in a regular way
function rtt(ip, time) {
  return { ip: ip, rtt: time};
}
