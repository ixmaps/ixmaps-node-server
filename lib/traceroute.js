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

var isWin = (/^win/.test(require('os').platform())), traceCommand = 'traceroute', traceArgs = '-n -q 3';
if (isWin) {
  traceCommand = 'tracert';
  traceArgs = '-d';
}
var lastFound;

exports.trace = trace;

// execute a trace, call callback at the end.
// optionally call repCB as the results are received.
function trace(details, cb, reportCB) {
  lastFound = null;
  var host = details.domain;
  var command = safe(details.command || traceCommand);
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
          reportCB({ host: host, data: data.toString(), buffer: buf, hops: parseOutput(buf)});
        }
        buf += data.toString();
      }).on('end', function(data) {
        cb(null, parseOutput(buf));
      }).on('error', function(error) {
        cb(error);
      });
    }
  });
}

function parseHop(line) {
  line = line.replace(/\*/g, '0');
  if (isWin) line = line.replace(/</g,'');
  var s = line.split(' ');
  for (var i=s.length - 1; i > -1; i--) {
    if (s[i] === '') s.splice(i,1);
    if (s[i] === 'ms') s.splice(i,1);
  }

  if (isWin) return parseHopWin(s);
  else return parseHopNix(s);
}

function parseHopWin(line) {
  if (line[4] === 'Request')
    return false;

  var hop = {};
  hop[line[4]] = [ +line[1], +line[2], +line[3]];

  return hop;
}


// parse tr components; 0 for *, <ip address>, or <num ms>
function parseHopNix(line) {
  var hop = {};

  if (line[1] === '0') {
    hop[lastFound + '*'] = [-1, -1, -1];
    return hop;
  }

  var lastip = line[1];
  hop[line[1]] = [+line[2]];

  for (var i=3; i < line.length; i++) {
    if (net.isIP(line[i])) {
      lastip = line[i];
      if (!hop[lastip])
        hop[lastip] = [];
    } else {
      hop[lastip].push(+line[i]);
    }
    lastFound = lastip;
  }

  return hop;
}

function parseOutput(output) {
  var i, lines = output.split('\n'), hops=[];

  lines.shift();
  lines.pop();

  if (isWin) {
    for (i = 0; i < lines.length; i++) {
      if (/^\s+1/.test(lines[i])) {
        break;
      }
    }
    lines.splice(0, i);
    lines.pop(); lines.pop();
  }

  for (i = 0; i < lines.length; i++)
    hops.push(parseHop(lines[i]));

    return hops;
}

// block text that's not safe for execFile
function safe(str, def) {
  return enabledPrograms.indexOf(str) > -1 ? str : def;
}
