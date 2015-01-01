// # OS specific parsing: *Nix (Linux, BSD, MacOS)

/* jslint node: true */

'use strict';

var net   = require('net'), _ = require('lodash'), traceroute = require('./traceroute');

exports.parse = parse;
exports.parseHop = parseHop;

// preserve current IP between hops for timeouts
var curIP;

// parse buffered output of traceroute and return individual hops
function parse(output, attempts) {
  var i, lines = output.split('\n'), hops = [];

// remove header
  lines.shift();

  for (i = 0; i < lines.length; i++) {
    var res = parseHop(lines[i], attempts);
    if (res && res.length) {
      hops.push(res);
    }
  }

  return hops;
}

// parse a line into a hop
function parseHop(line, attempts) {
  if (!line && !line.length) {
    return;
  }
  console.log('LINE', line);
  if (attempts < 1) {
    throw new Error('missing number of attempts');
  }
  var i;

  // cleanup line
  line = line.replace(/\*/g, '-1');
  var els = line.split(' ');

  for (i = els.length - 1; i > -1; i--) {
    if (els[i] === '') els.splice(i, 1);
    if (els[i] === 'ms') els.splice(i, 1);
  }

// parse tr components; -1 for *, <ip address>, !condition, or <num ms>

// target could not be reached
  if (els[1] === '-1') {
    return;
  }

  var hop = [];
  curIP = els[1];

  for (i = 2; i < els.length; i++) {
    var el = els[i];
    if (parseFloat(el) != el) {
// returned a new path, like this:
//    206.80.192.221 (206.80.192.221)  127.569 ms vdsla121.phnx.uswest.net (216.161.182.121)  185.214 ms *
      if (net.isIP(el)) {
        curIP = el;
      // returned an error
      } else if (el.indexOf('!') === 0) {
      } else {
        console.err('unknown result', el);
      }
    } else {
      hop.push(traceroute.rtt(curIP, el));
    }
  }
  return hop;
}
