// # ixmaps local server
//
// Receives host requests and traceroutes them.

/* jslint node: true */
'use strict';

var express = require('express');
var app = express();
var port = process.env.PORT || 8181;
var router = express.Router();
var bodyParser = require('body-parser');
var fs = require('fs');
var markdown = require( "markdown" ).markdown;

var dePost = bodyParser.json();
var traceroute = require('./lib/traceroute');
var requests = require('./lib/requests');
// when to refresh checked hosts (10 minutes)
var RECHECK_SECONDS = 600 * 1000;

// state variables
var state = {
// all the hops that have been logged
  allHops : {},
// hosts that have been traced
  processedHosts : {},
  // hosts queued to be traced
  // format: { domain: <domain>, command: <command>, args: <args> }
  queuedHosts : [],
  // are we currently processing a queued host?
  processingHost : false
};

app.use(express.static(__dirname + '/public'));

// log the request
router.use(function(req, res, next) {
  console.log(req.connection.remoteAddress, req.method, req.path, new Date());
  next();
});

/// send the README file
router.get('/', function(req, res) {
  fs.readFile('./README.md', function(err, data) {
    res.send(markdown.toHTML(data.toString()));
  });
});

// retrieve the traced paths
router.get('/api/traces', function(req, res) {
  res.json({ allHops: state.allHops});
});

// retrieve the traced paths
router.get('/api/state', function(req, res) {
  state.now = new Date().getTime();
  res.json(state);
});

// queue a host
router.post('/api/requests', dePost, function(req, res) {
  var incoming = req.body;
  // process individual requests
  requests.processRequests(incoming, function(err, request) {
    if (err) {
      console.log('requests err', err);
    } else {
      state.queuedHosts = state.queuedHosts.concat(request);
      console.log('added', request);
    }
  });

  res.end();
});

app.use(router);
app.listen(port);
console.log('Server listening on port ' + port);

// start the queue
processQueue();

// process a queue item or reset the timer
function processQueue() {
  if (state.processingHost) {
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
      var hops = [], traceID = destination + '@' + new Date().getTime();

      // process the hops returned by traceroute
      var processHops = function(err, hop) {
        if (!err) {
          if (hop) {
            var ip = Object.keys(hop)[0];
            hops.push({ ip: ip, roundTrips: hop[ip] });
          }
        } else {
          console.log('err', err);
        }
      },
      // reset state and wait for another process
      doneTrace = function() {
        state.allHops[traceID] = hops;
        console.log('allHops', Object.keys(state.allHops).length);
        state.processingHost = false;
        setTimeout(processQueue, 100);
      };

      state.processingHost = new Date().getTime();
      state.processedHosts[destination] = new Date().getTime();
    	traceroute.stream(destination, processHops, doneTrace, { command : nextHost.command, args: nextHost.args});
      return;
    }
  }
  // nothing to process, wait around
  setTimeout(processQueue, 100);
}
