// # Mocha tests for parsing *Nix (Linux, BSD, MacOS)

/* jslint node: true */
/* global describe, it */

'use strict';

var expect = require('expect.js'), net = require('net');

var parse = require('../lib/parseNix');

describe('parseNix', function () {

  describe('parse()', function () {
    it('should parse a route', function () {
      var buffer = ['traceroute to 10.5.128.98, 30 hops max, 60 byte packets',
        ' 1 192.168.0.1 0.994 ms 0.444 ms 0.449 ms 0.426 ms',
        ' 2 * * * *',
        ' 3 10.6.0.157 40.233 ms 106.772 ms 62.710 ms *'].join('\n');
      var res = parse.parse(buffer);

      expect(res.length).to.be(3);

      var h1 = Object.keys(res[0])[0];
      var h2 = Object.keys(res[1])[0];
      describe('validate addresses', function () {
        it('should be a NAT address', function () {
          expect(h1).to.be.equal('192.168.0.1');
        });
        it('should have timeouts for the second hop', function () {
          expect(h1).to.equal(h2);
          expect(res[1][h2].every(function(i) {
            return i === -1;
          })).to.be(true);
        });
      });
      describe('validate hops', function () {
        it('should have one hop result for each line', function () {
          expect(res.every(function(h) {
            return Object.keys(h).length === 1;
          })).to.be(true);
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
