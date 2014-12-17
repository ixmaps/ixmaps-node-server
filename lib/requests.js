// # Requests
//
// Manages receiving, queuing and executing trace requests with reporting.

/* jslint node: true */
'use strict';

var http = require('http');
var traceroute = require('./traceroute');
var querystring = require('querystring');

var TRSETS_BASE = 'http://ixmaps.ca/trsets/';

// when to refresh checked hosts (no delay)
var RECHECK_SECONDS = 0 * 1000;
// how many hosts to process at once
var parallel = 10;

// number of attempts per hop
var attempts = 4;
var SUBMIT_URI = 'http://ixmaps.ca/cgi-bin/gather-tr.cgi';
var TRID_PREFIX = 'new traceroute ID=';
var ERROR_PREFIX = 'ERROR';
// passed callback for trace progress and completeness (from traceroute implementation)
var reportCB = null, doneCB = null;

var doSubmitTrace = false, debug = false;

// state variables
var state = {
// all the hops that have been logged
  allHops : {},
// processing time of hosts that have been traced
  processedHosts : {},
  // hosts queued to be traced
  // format: { domain: <domain>, command: <command>, args: <args> }
  queuedHosts : [],
  // currently processing hosts
  processingHosts : {}
};

// get the current requests state
exports.getState = function() {
  state.now = new Date().getTime();
  return state;
};

exports.setDebug = function(v) {
  debug = v;
};

// sends a trace details
exports.setTraceProgressCB = function(cb) {
  reportCB = cb;
};

// a trace has been completed
exports.setTraceDoneCB = function(cb) {
  doneCB = cb;
};

exports.getDebug = function() {
  return debug;
};

exports.getSubmit = function() {
  return doSubmitTrace;
};

exports.setSubmit = function(v) {
  doSubmitTrace = v;
};

exports.setParallel = function(v) {
  parallel = v;
};

exports.processRequests = processRequests;

// Kicks off checking for queued items
exports.processQueue = function() {
  setInterval(doProcessQueue, 500);
};

// Transforms raw requests into URls that can be processed.
// Callback is usually processIncoming.
function processRequests(incoming, callback) {
  incoming.requests.forEach(function(request) {
    var toProc = function(domain) {
      return { tag: request.tag, command: request.command, args: request.args, submitter: request.submitter, postalcode: request.postalcode, domain: domain };
    };
    // URL submitted on Chrome access
    if (request.type === 'chrome.completed') {
      callback(null, toProc(request.properties.domain));
    // a domain or TRSET reference
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
        callback(null, toProc(data));
      }
    } else {
      callback({ 'unknown request': request});
    }
  });
}

// process incoming results processed by processRequests
exports.processIncoming = function(err, request) {
  if (err) {
    console.log('requests err', err);
  } else {
    state.queuedHosts = state.queuedHosts.concat(Array.isArray(request) ? request : [request]);
    if (debug) console.log('added', request);
  }
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

// Checks if max requests are being processed, if not and one is pending queues it
function doProcessQueue() {
  if (Object.keys(state.processingHosts).length >= parallel) {
    return;
  }
  var nextHost = state.queuedHosts.shift();
  if (nextHost) {
    var destination = nextHost.domain;
    // there's a destination and it hasn't processed or hasn't been processed recently
    var doProcess = !state.processedHosts[destination] || state.processedHosts[destination] < (new Date().getTime() - RECHECK_SECONDS);
    console.log('processing', nextHost.command, nextHost.domain, 'doProcess', doProcess, 'remaining', state.queuedHosts.length);
    if (doProcess) {
      // used to link hops
      var traceID = destination + '@' + new Date().getTime() + (nextHost.tag ? ':' + nextHost.tag : '');

      // process the hops returned by traceroute
      var processHops = function(err, hopRes) {
        var hops = [];
        if (debug) console.log('hops', JSON.stringify(hopRes));
        if (!err) {
          hopRes.forEach(function(hop) {
            if (hop) {
              // pad hops to attempts
              var ip = Object.keys(hop)[0];
              var hopLatencies = hop[ip];
              while (hopLatencies.length < attempts) {
                hopLatencies.push(-1);
              }
              hops.push({ ip: ip, roundTrips: hopLatencies });
            }
          });
        } else {
          console.log('err', err);
        }
        doneTrace(err, hops);
      },
      // reset state and wait for another process
      doneTrace = function(err, hops) {
        delete state.processingHosts[traceID];
        if (doSubmitTrace) {
          sendTrace(hops, nextHost, function(err, res) {
            if (err) {
              console.log('sendTrace failed', err);
              res = { sendTraceFailed: err};
            }
            state.allHops[traceID] = { traceID: traceID, result: res, hops: hops};
            if (debug) console.log('submitted trace', res);
            if (doneCB) {
              doneCB(err, state.allHops[traceID]);
            }
          });
        } else {
          state.allHops[traceID] = { traceID: traceID, hops: hops};
          if (doneCB) {
            doneCB(err, state.allHops[traceID]);
          }
        }

        console.log('done; allHops', Object.keys(state.allHops).length);
      };

      state.processingHosts[traceID] = new Date().getTime();
      state.processedHosts[destination] = new Date().getTime();
      nextHost.traceID = traceID;
      traceroute.trace(nextHost, processHops, reportCB);
      return;
    }
  }
  // nothing to process, wait around
}

/*

# Transmit a completed trace

Send metadata, and for each hop, encoded as field_hop#_probe, send:

  status_1_1=r
  ip_addr_1_1=209.148.244.0
  rtt_ms_1_1=12

Use seen to avoid duplicates, and don't send the last hop (the destination).

*/
function sendTrace(hops, details, cb) {
  var seen = {}, submitted = 0, t = {
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

  for (var h = 0; h < hops.length - 1; h++) {
    var hop = hops[h];
    // only submit each address once
    if (seen[hop.ip]) {
      continue;
    }
    seen[hop.ip] = 1;
    if (hop.roundTrips) {
      for (var p = 0; p < hop.roundTrips.length; p++) {
        var rid = '_' + (h + 1) + '_' + (p + 1);
        t['status' + rid] = hop.roundTrips[p] > -1 ? 'r' : 't';
        t['ip_addr' + rid] = hop.ip;
        t['rtt_ms' + rid] = Math.floor(hop.roundTrips[p]);
        submitted++;
      }
    }
  }

  t.n_items = submitted;
  if (debug) console.log('submitting', JSON.stringify(t, null, 2), querystring.stringify(t));
  submitTR(SUBMIT_URI + '?' + querystring.stringify(t), function(err, res) {
    if (debug) console.log('server response', 'err', err, 'res', res);
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
