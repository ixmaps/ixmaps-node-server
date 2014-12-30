// # OS specific parsing: *Nix (Linux, BSD, MacOS)

/* jslint node: true */

'use strict';

var net   = require('net');

exports.parse = parse;
exports.parseHop = parseHop;

// preserve current IP between hops for timeouts
var curIP;

// parse buffered output of traceroute and return individual hops
function parse(output) {
  var i, lines = output.split('\n'), hops = [];

// remove header
  lines.shift();

  for (i = 0; i < lines.length; i++) {
    hops.push(parseHop(lines[i]));
  }

  return hops;
}

// parse a line into a hop
function parseHop(line) {
  var hop = {}, i;

  // cleanup line
  line = line.replace(/\*/g, '-1');
  var els = line.split(' ');

  for (i = els.length - 1; i > -1; i--) {
    if (els[i] === '') els.splice(i, 1);
    if (els[i] === 'ms') els.splice(i, 1);
  }

// parse tr components; 0 for *, <ip address>, or <num ms>

// target could not be reached
  if (els[1] === '-1') {
    hop[curIP] = [-1, -1, -1, -1];
    return hop;
  }

  curIP = els[1];
  if (!hop[curIP]) {
    hop[curIP] = [];
  }

  for (i = 2; i < els.length; i++) {
    var el = els[i];
    // returned a new path, like this:
    //    206.80.192.221 (206.80.192.221)  127.569 ms vdsla121.phnx.uswest.net (216.161.182.121)  185.214 ms *
    if (parseFloat(el) != el) {
      console.log('NAN', '"'+el+'"');
      curIP = el;
      if (!hop[curIP]) {
        hop[curIP] = [];
      }
    } else {
      hop[curIP].push(el);
    }
  }
  return hop;
}
