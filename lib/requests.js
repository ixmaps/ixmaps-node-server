// # Requests

/* jslint node: true */
'use strict';

var http = require('http');
var TRSETS_BASE = 'http://ixmaps.ca/trsets/';

// Transforms raw requests into URls that can be processed.

exports.processRequests = function(incoming, callback) {
  incoming.requests.forEach(function(request) {
    var toProc = function(domain) {
      return { command: request.command, args: request.args, submitter: request.submitter, postalcode: request.postalcode, domain: domain };
    };
    // URL submitted on Chrome access
    if (request.type === 'chrome.completed') {
      callback(null, toProc(request.properties.domain));
    // a domain or TRSET refererence
    } else if (request.type === 'submitted') {
      var data = request.data;
      if (!data) {
        callback({'invalid submission': data});
        return;
      }
      // Looks like a trset
      if (data.match(/^\d{2}: /)) {
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
                callback(null, toProc(domain));
              }
            });
          }
        });
      // Probably a domain
      } else {
        callback(null, [toProc(data)]);
      }
    } else {
      callback({ 'unknown request': request});
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
