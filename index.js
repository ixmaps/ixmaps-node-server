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
var requests = require('./lib/requests');

// command line args
process.argv.slice(2).forEach(function(a) {
  if (a === '-d') {
    requests.setDebug(true);
    requests.setTraceProgressCB(function(data, buf, hops) {
      console.log('DATA', data, '\nHOPS', hops);
    });
  } else if (a === '-y') {
    requests.setSubmit(true);
  } else {
    console.log('usage:', process.argv[1], '-y (submit result) -d (debug) -h (help)');
    process.exit(1);
  }
});

console.log('running', 'debug:', requests.getDebug(), 'submit:', requests.getSubmit());

app.use(express.static('./public'));

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
  res.json({ allHops: requests.getState().allHops});
});

// retrieve the traced paths
router.get('/api/state', function(req, res) {
  res.json(requests.getState());
});

// queue a host
router.post('/api/requests', dePost, function(req, res) {
  var incoming = req.body;
  // process individual requests
  requests.processRequests(incoming, requests.processIncoming);
  res.end();
});

app.use(router);
app.listen(port);
console.log('Server listening on port ' + port);

// start the queue
requests.processQueue();
