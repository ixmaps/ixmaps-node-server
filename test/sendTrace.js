// # Mocha tests for parsing *Nix (Linux, BSD, MacOS)
// examples from http://www.exit109.com/~jeremy/news/providers/traceroute.html#reading

/* jslint node: true */
/* global describe, it */

'use strict';

var expect = require('expect.js'), net = require('net'), _ = require('lodash');

var parse = require('../lib/parseNix');
var localAddress = '189.136.107.40', finalAddress = '201.234.65.134';

var res;

describe('sendTrace', function () {

  describe('setup', function () {
    it('should parse sample route', function () {
      var buffer = 'traceroute to 200.41.9.39 (200.41.9.39), 30 hops max, 60 byte packets\n 1  ' + localAddress + '  0.379 ms  0.644 ms  0.744 ms  0.894 ms\n 2  216.235.0.30  13.471 ms  13.481 ms  13.524 ms  13.514 ms\n 3  216.235.0.164  18.460 ms  18.460 ms  18.493 ms  18.482 ms\n 4  206.248.145.57  14.450 ms  14.563 ms  14.554 ms  14.605 ms\n 5  69.196.136.68  30.540 ms 69.196.136.74  15.446 ms 69.196.136.68  15.523 ms 69.196.136.41  15.342 ms\n 6  63.243.172.9  12.762 ms  12.864 ms  12.843 ms  13.438 ms\n 7  64.86.33.89  34.859 ms  33.589 ms  34.413 ms 64.86.33.26  33.550 ms\n 8  64.86.33.26  32.835 ms 64.86.32.34  32.722 ms 64.86.33.26  33.588 ms  33.323 ms\n 9  64.86.32.34  32.971 ms  32.922 ms 64.86.85.2  35.412 ms 64.86.32.34  32.456 ms\n10  64.86.85.2  32.876 ms  32.928 ms  33.237 ms 216.6.87.1  32.602 ms\n11  64.215.195.81  32.245 ms  32.525 ms  32.361 ms 216.6.87.1  32.707 ms\n12  64.215.195.81  32.786 ms 201.234.65.134  202.871 ms  203.286 ms  202.541 ms\n13  ' + finalAddress + '  202.236 ms  202.938 ms  200.884 ms 200.41.9.39  200.104 ms\n';
      res = parse.parse(buffer, 4);

      expect(res.length).to.be(13);
    });
  });

  describe('process', function() {
    it('should remove the local address', function() {
    });

    it('should remove failing steps', function() {
    });

    it('should normalize attempt counts', function() {
    });
  });

});
