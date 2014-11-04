// /# traceroute
//
// Adapted from https://github.com/jaw187/node-traceroute/pull/2

/* jslint node: true */
/* jslint esnext: true */
'use strict';

var net   = require('net');
var dns   = require('dns');
var child = require('child_process');
var enabledPrograms = ['traceroute', 'tracert', 'paris-traceroute'];

var isWin = (/^win/.test(require('os').platform())), traceCommand = 'traceroute', traceArgs = '-n';
if (isWin) {
  traceCommand = 'tracert';
 traceArgs = '-d';
}

module.exports.stream = stream;
module.exports.traceCommand = traceCommand;

function stream(host, hopBack, doneBack, options) {
  var command = safe(options.command || traceCommand, traceCommand), args = options.args || traceArgs;
  var hopper = traceHopper(host);
  host = (host + '').toUpperCase();

  var traceroute;

  dns.lookup(host, lookupCallback);

  function lookupCallback(err) {
    if (err && net.isIP(host) === 0) {
      doneBack({ err: 'Invalid host'});
      return;
    }

    traceroute = child.spawn(command, [args, host]);

    var line = '';
    traceroute.stdout.on('data', function onData(data) {
      data = data.toString();

      if (data.indexOf('\n') === -1) {
          line = line + data;
          return;
      }

      var parts = data.split('\n');
      line = line + parts[0];

      hopBack(null, hopper.parseHop(line));
      line = parts[1];
    });

    traceroute.stderr.on('data', function onData(data) {
      data = data + '';
      doneBack(new Error(data));
    });

    traceroute.on('error', doneBack);
    traceroute.on('close', function () {
      hopBack(null, hopper.parseHop(line));
      doneBack();
    });

  }
}

var traceHopper = function(h) {
  var host = h, lastFound;

  return {
    parseHop : function(line) {
      line = line.replace(/\*/g,'0').replace(/\n/g,'');

      if (isWin) {
        line = line.replace(/</g,'');
      }

      var parts = line.split(' ').filter(filter);

      if (parts[0] === '0' || !(/\d+/).test(parts[0])) {
        return false;
      }

      if (isWin) {
        return parseHopWin(parts);
      }

      return parseHopNix(parts);

      function filter(part) {
        return (part !== '' && part !== 'ms');
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
          lastip = (lastFound + '*').replace('**', '*');
        }
        lastFound = lastip;

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
    }
  };
};


// block text that's not safe for execFile
function safe(str, def) {
  return enabledPrograms.indexOf(str) > -1 ? str : def;
}
