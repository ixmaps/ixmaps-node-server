// # Mocha tests for parsing *Nix (Linux, BSD, MacOS)

/* jslint node: true */
/* global describe, it */

'use strict';

var expect = require('expect.js'), net = require('net');

var orderBuffer = "1 192.168.0.1 3.081 ms 0.462 ms 0.851 ms 0.446 ms\n 2 * * * *\n 3 10.6.0.157 39.422 ms 39.413 ms 40.208 ms 47.178 ms\n 4 * 10.5.128.98 40.068 ms 39.345 ms 39.930 ms\n 5 * 206.223.124.147 39.071 ms 40.362 ms 40.347 ms\n 6 * 201.234.65.134 40.894 ms 41.081 ms 41.836 ms\n 7 200.41.9.39 42.619 ms";
var parse = require('../lib/parseNix');

describe('parseNix', function () {

  describe('parse()', function () {
    it('should parse a route', function () {
      var t1 = ['traceroute to 10.5.128.98, 30 hops max, 60 byte packets',
        ' 1 192.168.0.1 0.994 ms 0.444 ms 0.449 ms 0.426 ms',
        ' 2 * * * *',
        ' 3 10.6.0.157 40.233 ms 106.772 ms 62.710 ms *'].join('\n');
      var res = parse.parse(t1);

      expect(res.length).to.be(3);

      var h1 = Object.keys(res[0])[0];
      var h2 = Object.keys(res[1])[0];
      describe('validate addresses', function () {
        it('should be a NAT address', function () {
          expect(h1).to.be.equal('192.168.0.1');
        });
        it('should have timeouts for thes econd hop', function () {
          expect(h1).to.eql(h2);
          expect(res[1][h2].every(function(i) { return i === -1; })).to.be(true);
        });
      });
      describe('validate hops', function () {
        it('should have one hop result for each line', function () {
          expect(res.every(function(h) { return Object.keys(h).length === 1; })).to.be(true);
        });

        it('should have an IP address for each hop', function () {
          expect(res.every(function(h) {
            var ip = Object.keys(h)[0];
            return net.isIP(ip);
          })).to.be(true);
        });

        it('should have four results for each hop', function () {
          expect(res.every(function(h) {
            var hops = h[Object.keys(h)[0]];
            return hops.length === 4;
          })).to.be(true);
        });
      });
    });
  });

  describe('parseHop()', function () {
  });

});
