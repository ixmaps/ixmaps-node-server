// # ixmaps local server
//
// Receives host requests and traceroutes them.

/* jslint node: true */
'use strict';

var http = require('http');
var express = require('express');
var app = express();
var port = process.env.PORT || 8181;
var router = express.Router();
var bodyParser = require('body-parser');
var fs = require('fs');
var markdown = require( "markdown" ).markdown;

var dePost = bodyParser.json();
var traceroute = require('./lib/traceroute');
// when to refresh checked hosts (10 minutes)
var RECHECK_SECONDS = 600 * 1000;
var TRSETS_BASE = 'http://ixmaps.ca/trsets/';

// state variables
var state = {
// all the hops that have been logged
  allHops : {},
// hosts that have been traced
  processedHosts : {},
  // hosts queued to be traced
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
  // URL submitted on Chrome access
  // a URL or TRSET refererence
  incoming.requests.forEach(function(request) {
    if (request.type === 'chrome.completed') {
      state.queuedHosts = state.queuedHosts.concat(incoming.requests);
    } else if (request.type === 'submitted') {
      var submitted = [];
        var data = request.data;
        if (!data) {
          console.log('invalid submission', data);
          return;
        }
        // it's a URL
        if (data.match(/https?:\/\//i)) {

        // see if it's a trset
        } else {
          retrieve(TRSETS_BASE + data, function(err, res) {
            if (err) {
              console.log('submitted trset failed', err);
            } else {
              console.log(res);
            }
          });
        }
    } else {
      console.log('unknown request', request);
    }
  });

  console.log('added', incoming.type, incoming.requests.length);
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
    var destination = nextHost.properties.domain;
    // there's a destination and it hasn't processed or hasn't been processed recently
    var doProcess = !state.processedHosts[destination] || state.processedHosts[destination] < (new Date().getTime() - RECHECK_SECONDS);
    console.log('processing', nextHost.command, nextHost.properties.domain, 'doProcess', doProcess, 'remaining', state.queuedHosts.length);
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
    	traceroute.stream(destination, processHops, doneTrace, { command : nextHost.command, parameters: nextHost.parameters});
      return;
    }
  }
  // nothing to process, wait around
  setTimeout(processQueue, 100);
}

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
