var rawtrace = require('./socket-trace.js');

// dest, timeout, interval
rawtrace({ dest: 'zooid.org', timeout: 9000, interval: 10, count: 1, maxTTL: 32}, function(err, res) {
  console.log(err, res);
});
