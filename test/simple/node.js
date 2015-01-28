'use strict';

var test = require('tap').test;
var async = require('async');
var endpoint = require('endpoint');
var PassThrough = require('stream').PassThrough;

var jobs = require('../../lib/job.js');
var Node = require('../../lib/node.js');
var types = require('../../lib/types.js');

var settings = {
  address: '127.0.0.1',
  port: 8087
};

var MessageJob = jobs.MessageJob;
function message(node, type, data, callback) {
  node.message(new MessageJob(type, data, callback));
}

var StreamJob = jobs.StreamJob;
function stream(node, type, data) {
  var ret = new PassThrough({ objectMode: true, highWaterMark: 1 });
  node.stream(new StreamJob(type, data, ret));
  return ret;
}

test('open flag', function (t) {
  var node = new Node(settings);

  t.strictEqual(node.open, false);
  node.connect();
  t.strictEqual(node.open, false);

  node.once('connect', function () {
    t.strictEqual(node.open, true);

    node.close();
    t.strictEqual(node.open, false);

    node.once('close', function () {
      t.strictEqual(node.open, false);
      t.end();
    });
  });
});

test('ping by simple message', function (t) {
  var node = new Node(settings);
  node.connect();
  node.once('connect', function () {
    var usedFired = false;
    var freeFired = false;

    node.once('used', function () {
      usedFired = true;
      t.equal(freeFired, false);
      t.equal(node.inuse, true);
    });

    node.once('free', function () {
      freeFired = true;
      t.equal(usedFired, true);
      t.equal(node.inuse, false);
    });

    message(node, types.RpbPingReq, {}, function (err, data) {
      t.equal(err, null);
      t.equal(data, null);
      t.strictEqual(node.inuse, false);
      t.equal(usedFired, true);
      t.equal(freeFired, true);

      node.close();
      node.once('close', t.end.bind(t));
    });

    t.strictEqual(node.inuse, true);
  });
});

test('last request timestamp', function (t) {
  var node = new Node(settings);

  function within(now) {
    return Math.abs(node.lastRequest - now) <= 5;
  }
  t.ok(within(Date.now()), 'initial lastRequest set now');

  node.connect();
  node.once('connect', function () {

    setTimeout(function () {
      message(node, types.RpbPingReq, {}, function (err, data) {
        t.equal(err, null);
        t.equal(data, null);

        t.ok(within(Date.now()), 'lastRequest set at response');

        node.close();
        node.once('close', t.end.bind(t));
      });
    }, 50);
  });
});

test('error for multiply request using message', function (t) {
  var node = new Node(settings);
  node.connect();
  node.once('connect', function () {
    var error = null;

    message(node, types.RpbPingReq, {}, function (err, data) {
      t.equal(err, null);
      t.equal(data, null);
      t.equal(error.message, 'node is in use');
      t.strictEqual(node.inuse, false);

      node.close();
      node.once('close', t.end.bind(t));
    });

    message(node, types.RpbPingReq, {}, function (err) {
      error = err;
    });
  });
});

test('error in callback for connection error', function (t) {
  var node = new Node({ address: '127.0.0.1', port: 0xBAD });
  node.connect();

  var nodeError = null;

  message(node, types.RpbPingReq, {}, function (err, data) {
    // Expect the callback to fire becore the event
    t.equal(nodeError, null);
    t.equal(data, null);

    process.nextTick(function () {
      t.equal(err.message, 'connect ECONNREFUSED');
      t.equal(nodeError.message, 'connect ECONNREFUSED');

      node.close();
      node.once('close', t.end.bind(t));
    });
  });

  node.once('error', function (err) {
    nodeError = err;
  });
});

test('riak errors in the single message case', function (t) {
  var node = new Node(settings);
  node.connect();
  node.once('connect', function () {
    message(node, types.RpbGetBucketReq, {
      bucket: new Buffer('riak-client-test'),
      type: new Buffer('missing-bucket-type')
    }, function (err) {
      t.equal(err.name, 'Riak Error');
      t.equal(err.message, "No bucket-type named 'missing-bucket-type'");
      t.equal(err.code, 0);
      t.equal(typeof err.stack, 'string');

      node.close();
      node.once('close', t.end.bind(t));
    });
  });
});

test('message requests will fail when closeing', function (t) {
  var node = new Node(settings);
  node.connect();

  message(node, types.RpbListBucketsReq, {}, function (err, response) {
    t.equal(err.message, 'connection closed');
    t.equal(response, null);

    node.once('close', t.end.bind(t));
  });
  node.close();
});

var objects = [
  {key: 'A', content: 'Message A'},
  {key: 'B', content: 'Message B'},
  {key: 'C', content: 'Message C'}
];

test('store three objects', function (t) {
  var node = new Node(settings);
  node.connect();
  node.once('connect', function () {

    async.mapSeries(objects, function (val, done) {
      message(node, types.RpbPutReq, {
        bucket: new Buffer('riak-client-test'),
        key: new Buffer(val.key),
        content: { value: new Buffer(val.content) }
      }, done);
    }, function (err, responses) {
      t.equal(err || null, null);
      t.deepEqual(responses, [
        { content: [], vclock: null, key: null },
        { content: [], vclock: null, key: null },
        { content: [], vclock: null, key: null }
      ]);

      node.close();
      node.once('close', t.end.bind(t));
    });
  });
});

test('fetch three objects', function (t) {
  var node = new Node(settings);
  node.connect();
  node.once('connect', function () {

    async.mapSeries(objects, function (val, done) {
      message(node, types.RpbGetReq, {
        bucket: new Buffer('riak-client-test'),
        key: new Buffer(val.key)
      }, done);
    }, function (err, responses) {
      t.equal(err || null, null);

      t.deepEqual(responses.map(function (response, i) {
        return {
          key: objects[i].key,
          content: response.content[0].value.toString()
        };
      }), objects);

      node.close();
      node.once('close', t.end.bind(t));
    });
  });
});

test('read keys by stream', function (t) {
  var node = new Node(settings);
  node.connect();
  node.once('connect', function () {

    stream(node, types.RpbListKeysReq, {
      bucket: new Buffer('riak-client-test')
    }).pipe(endpoint({objectMode: true}, function (err, content) {
      t.equal(err, null);
      t.ok(content.length > 1, 'more than one response messsage');

      var keys = Array.prototype.concat.apply([],
        content.map(function (data) { return data.keys; })
      );

      t.deepEqual(keys.map(function (buf) { return buf.toString(); }).sort(), [
        'A', 'B', 'C'
      ]);

      node.close();
      node.once('close', t.end.bind(t));
    }));
  });
});

test('error for multiply requests using stream', function (t) {
  var node = new Node(settings);
  node.connect();
  node.once('connect', function () {
    var error = null;

    stream(node, types.RpbListKeysReq, {
      bucket: new Buffer('riak-client-test')
    }).pipe(endpoint({objectMode: true}, function (err, content) {
      t.equal(err, null);
      t.ok(content.length > 1, 'more than one response messsage');
      t.equal(error.message, 'node is in use');

      node.close();
      node.once('close', t.end.bind(t));
    }));

    stream(node, types.RpbListKeysReq, {
      bucket: new Buffer('riak-client-test')
    }).pipe(endpoint({objectMode: true}, function (err, content) {
      t.equal(content.length, 0);
      error = err;
    }));
  });
});

test('riak errors in the stream case', function (t) {
  var node = new Node(settings);
  node.connect();
  node.once('connect', function () {
    stream(node, types.RpbListKeysReq, {
      bucket: new Buffer('riak-client-test'),
      type: new Buffer('missing-bucket-type')
    }).pipe(endpoint({objectMode: true}, function (err) {
      t.equal(err.name, 'Riak Error');
      t.equal(err.message, "No bucket-type named 'missing-bucket-type'");
      t.equal(err.code, 0);
      t.equal(typeof err.stack, 'string');

      node.close();
      node.once('close', t.end.bind(t));
    }));
  });
});

test('stream requests will fail when closeing', function (t) {
  var node = new Node(settings);
  node.connect();

  stream(node, types.RpbListKeysReq, {
    bucket: new Buffer('riak-client-test')
  }).pipe(endpoint({objectMode: true}, function (err) {
    t.equal(err.message, 'connection closed');

    node.once('close', t.end.bind(t));
  }));

  node.close();
});

test('error in stream for connection error', function (t) {
  var node = new Node({ address: '127.0.0.1', port: 0xBAD });
  node.connect();

  var nodeError = null;

  stream(node, types.RpbListKeysReq, {
    bucket: new Buffer('riak-client-test'),
    type: new Buffer('missing-bucket-type')
  }).pipe(endpoint({objectMode: true}, function (err) {
    // Expect the stream event to fire becore the node event
    t.equal(nodeError, null);

    process.nextTick(function () {
      t.equal(err.message, 'connect ECONNREFUSED');
      t.equal(nodeError.message, 'connect ECONNREFUSED');

      node.close();
      node.once('close', t.end.bind(t));
    });
  }));

  node.once('error', function (err) {
    nodeError = err;
  });
});

test('remove three objects', function (t) {
  var node = new Node(settings);
  node.connect();
  node.once('connect', function () {

    async.mapSeries(objects, function (val, done) {
      message(node, types.RpbDelReq, {
        bucket: new Buffer('riak-client-test'),
        key: new Buffer(val.key)
      }, done);
    }, function (err, responses) {
      t.equal(err || null, null);
      t.deepEqual(responses, [null, null, null]);

      node.close();
      node.once('close', t.end.bind(t));
    });
  });
});

test('error at connection without active job', function (t) {
  var node = new Node({ address: '127.0.0.1', port: 0xBAD });
  node.connect();

  node.once('error', function (err) {
    t.equal(err.message, 'connect ECONNREFUSED');

    node.close();
    node.once('close', t.end.bind(t));
  });
});
