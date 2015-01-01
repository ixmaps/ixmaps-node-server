// # Trsets
//
// Manages sets of IP addresses accessed from the server

/* jslint node: true */
'use strict';

var TRSETS_BASE = 'http://ixmaps.ca/trsets/';

var http = require('http');

exports.request = function(data, callback) {
  var trset = TRSETS_BASE + data.replace(/ /g, '_') + '.trset';
  console.log('retrieving', trset);
  retrieve(trset, function(err, res) {
    if (err) {
      callback({'submitted trset failed': err});
      return;
    } else {
      res.split('\n').forEach(function(s) {
        if (s.match(/^host /)) {
          var domain = s.replace(/.* /, '');
          callback(null, domain);
        }
      });
    }
  });
};

// Return cached or retrieved URI
function retrieve(uri, callback) {
  var buffer;
  http.get(uri, function(res) {
    res.on('data', function (chunk) {
      buffer += chunk;
    });
    res.on('end', function() {
      callback(null, buffer);
    });
  }).on('error', function(e) {
    callback(e);
  });
}
