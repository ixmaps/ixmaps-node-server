/* jslint node: true */
'use strict';

var raw = require('raw-socket');

var packet;

exports.generate = function(ident_length) {
  packet = new Buffer(5+ident_length);
  packet.fill(0x00);

  // Echo request
  packet[0] = 0x08;

  // Identifier
  while(ident_length--) {
    packet.writeInt8(rand(), 5+ident_length, true);
  }
};

exports.get = function() {
  return packet;
};

exports.setTTL = function(ttl) {
  packet.writeInt8(ttl, 4, true);

  // Reset checksum
  packet[2] = 0x00; packet[3] = 0x00;
  raw.writeChecksum(packet, 2, raw.createChecksum(packet));
};

function rand() {
  return (Math.random()*16|0);
}
