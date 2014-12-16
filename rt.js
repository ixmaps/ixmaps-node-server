var rawtrace = require('./lib/socket-trace.js');

// dest, timeout, interval
rawtrace({ dest: process.argv[2], timeout: 9000, interval: 10, count: 4, maxTTL: 32}, function(err, res) {
  console.log(err, res);
});
