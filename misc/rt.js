var rawtrace = require('./lib/socket-trace.js'), _ = require('lodash');

var passes = {}, lastPass = -1, lastSource = null;
// dest, timeout, interval
rawtrace({ dest: process.argv[2], timeout: 100, interval: 10, count: 1, maxTTL: 32}, function(err, res) {
  if (err) {
    console.log('err', err);
  } else {
    console.log('res', res);
    if (lastPass != res.pass) {
      lastPass = res.pass;
      passes[res.pass] = 'graph TD;';
    } else {
      passes[res.pass] += '\n  ' + lastSource + '-->' + res.source;
    }
    lastSource = res.source;
  }
}, function() {
  console.log(_.uniq(Object.keys(passes).map(function(k) { return passes[k]; })));
});
