/*

# Transmit a completed trace

Send metadata, and for each hop, encoded as field_hop#_probe, send:

status_1_1=r
ip_addr_1_1=209.148.244.0
rtt_ms_1_1=12

*/
/* jslint node: true */
'use strict';

var http = require('http'), querystring = require('querystring');

var traceroute = require('./traceroute');

var attempts;

var SUBMIT_URI = 'http://www.ixmaps.ca/cgi-bin/gather-tr.cgi';
var TRID_PREFIX = 'new traceroute ID=';
var ERROR_PREFIX = 'ERROR';

exports.normalizeHopsForSubmission = normalizeHopsForSubmission;

exports.sendTrace = function(hopsIn, details, cb) {
  var hops = removeLocal(hopsIn);
  attempts = details.attempts;
  var submitted = 0, t = {
    dest: details.domain,
    dest_ip: details.dest_ip,
    submitter:details.submitter,
    zip_code:details.postalcode,
    client:'ixnode',
    cl_ver: 0,
    privacy:8,
    timeout:1,
    protocol:'i',
    maxhops:255,
    attempts: attempts,
    status:'c'
  };

  normalizeHopsForSubmission(hops);

  for (var h = 0; h < hops.length - 1; h++) {
    var hop = hops[h];
    for (var p = 0; p < hop.length; p++) {
      var attempt = hop[p];
      var rid = '_' + (h + 1) + '_' + (p + 1);
      t['status' + rid] = attempt.rtt > -1 ? 'r' : 't';
      t['ip_addr' + rid] = attempt.ip;
      t['rtt_ms' + rid] = Math.floor(attempt.rtt);
      submitted++;
    }
  }

  t.n_items = submitted;
  if (GLOBAL.debug) console.log('submitting', JSON.stringify(t, null, 2), querystring.stringify(t));
  submitTR(SUBMIT_URI + '?' + querystring.stringify(t), function(err, res) {
    if (GLOBAL.debug) console.log('server response', 'err', err, 'res', res);
    var trid, subError;
    if (err) {
      console.log('tr submission failed', err);
    } else {
      if (res.indexOf(ERROR_PREFIX) > -1) {
        subError = res.split(ERROR_PREFIX)[1].split('\n')[0];
      }

      if (res.indexOf(TRID_PREFIX) > -1) {
        trid = res.split(TRID_PREFIX)[1].replace(/[^0-9]/g, '');
      }
      cb(err, { trid: trid, error: subError});
    }
  });
};

function normalizeHopsForSubmission(hops) {
  hops.forEach(function(hop) {
    // pad hops to attempts
    var lastIP = hop[hop.length - 1].ip;
    if (!lastIP) {
      console.err('missing ip', JSON.stringify(hop, null, 2));
      return null;
    }
    while (hop.length < attempts) {
      hop.push(traceroute.rtt(lastIP, -1));
    }
  });
  return hops;
}


// remove local addresses FIXME
function removeLocal(hops) {
  return hops.slice(1);
}

// submit the data and callback the result
function submitTR(url, callback) {
  http.get(url, function(res) {
    var data = '';
    res.on('data', function (chunk) {
      data += chunk;
    });
    res.on('end', function() {
      callback(null, data);
    });
  }).on('error', function(err) {
    callback(err);
  });
}
