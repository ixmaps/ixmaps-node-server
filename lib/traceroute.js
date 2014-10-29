// /# traceroute
//
// Adapted from https://github.com/jaw187/node-traceroute/pull/2

/* jslint node: true */
'use strict';

var net   = require('net');
var dns   = require('dns');
var child = require('child_process');

var isWin = (/^win/.test(require('os').platform())), traceCommand = 'traceroute', traceArgs = '-n';
if (isWin) {
  traceCommand = 'tracert';
 traceArgs = '-d';
}

module.exports.stream = stream;
module.exports.traceCommand = traceCommand;

function stream(host, callback, doneBack, options) {
  var command = safe(options.command || traceCommand, traceCommand), parameters = options.parameters || traceArgs;
  callback = callback || function() {};
  host = (host + '').toUpperCase();

  var traceroute;

  dns.lookup(host, lookupCallback);

  function lookupCallback(err) {
    if (err && net.isIP(host) === 0) {
      return callback('Invalid host');
    }

    traceroute = child.spawn(command, [parameters, host]);

    var line = '';
    traceroute.stdout.on('data', function onData(data) {
      data = data.toString();

      if (data.indexOf('\n') === -1) {
          line = line + data;
          return;
      }

      var parts = data.split('\n');
      line = line + parts[0];

      callback(null, parseHop(line));
      line = parts[1];
    });

    traceroute.stderr.on('data', function onData(data) {
      data = data + '';
      callback(new Error(data));
    });

    traceroute.on('error', doneBack);
    traceroute.on('close', function () {
      callback(null, parseHop(line));
      doneBack();
    });

  }
}

function parseHop(line) {
  line = line.replace(/\*/g,'0').replace(/\n/g,'');

  if (isWin) {
    line = line.replace(/</g,'');
  }

  function filter(part) {
    return (part !== '' && part !== 'ms');
  }

  var parts = line.split(' ').filter(filter);

  if (parts[0] === '0' || !(/\d+/).test(parts[0])) {
    return false;
  }

  if (isWin) {
    return parseHopWin(parts);
  }

  return parseHopNix(parts);
}

function parseHopWin(parts) {
  // line handlers for stream
  var done = false;
  [ 'Tracing', 'over', 'Trace' ].forEach(function(chk) {
    if (parts[0] === chk) done = true;
  });

  if (done) return false;

  if (parts[4] === 'Request') {
    return false;
  }

  var hop = {};
  hop[parts[4]] = [ +parts[1], +parts[2], +parts[3] ];
  return hop;
}

function parseHopNix(parts) {
  if (parts[0] === 'traceroute') {
    return false;
  }
  parts.shift();

  var hop = {};
  var lastip = parts.shift();

  if (!net.isIP(lastip)) {
    return false;
  }

  hop[lastip] = [];

  parts.forEach(function(part) {
    if (net.isIP(part)) {
      lastip = part;
      hop[lastip] = [];
      return;
    }

    hop[lastip].push(+part);
  });

  return hop;
}

// block text that's not safe for execFile
function safe(str, def) {
  return ['traceroute', 'tracert', 'paris-traceroute'].indexOf(str) > -1 ? str : def;
}
