// # Requests
//
// Manages receiving, queuing and executing trace requests with reporting.

/* jslint node: true */
'use strict';

var traceroute = require('./traceroute'), sender = require('./sendTrace'), trsets = require('./trsets');

// when to refresh checked hosts (no delay)
var RECHECK_SECONDS = 0 * 1000;
// how many hosts to process at once
var parallel = 10;

// number of attempts per hop
var attempts = 4;

// passed callback for trace progress and completeness (from traceroute implementation)
var reportCB = null, doneCB = null;

var doSubmitTrace = false;
GLOBAL.debug = false;

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
  GLOBAL.debug = v;
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
  return GLOBAL.debug;
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
        trsets.request(data, function(err, domain) { callback(err, toProc(domain)); });
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
    if (GLOBAL.debug) console.log('added', request);
  }
};

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

      // process hops, reset state
      var doneTrace = function(err, hops) {
        if (err || hops.length < 1) {
          console.log('doneTrace err', err, hops);
        }
        if (GLOBAL.debug) console.log('hops', JSON.stringify(hops, null, 2));
        delete state.processingHosts[traceID];
        if (doSubmitTrace) {
          sender.sendTrace(hops, nextHost, function(err, res) {
            if (err) {
              console.log('sendTrace failed', err);
              res = { sendTraceFailed: err};
            }
            state.allHops[traceID] = { traceID: traceID, result: res, hops: hops};
            if (GLOBAL.debug) console.log('submitted trace', res);
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
      nextHost.attempts = attempts;
      traceroute.trace(nextHost, doneTrace, reportCB);
      return;
    }
  }
  // nothing to process, wait around
}
