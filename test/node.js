'use strict';

var test = require('tap').test;
var async = require('async');
var endpoint = require('endpoint');
var PassThrough = require('stream').PassThrough;

var jobs = require('../lib/job.js');
var Node = require('../lib/node.js');
var types = require('../lib/types.js');

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

    message(node, types.RpbPingReq, {}, function (err, data) {
      t.equal(err, null);
      t.equal(data, null);
      t.strictEqual(node.inuse, false);

      node.close();
      node.once('close', t.end.bind(t));
    });

    t.strictEqual(node.inuse, true);
  });
});

test('error for multiply request', function (t) {
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
      t.equal(err, null);
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
      t.equal(err, null);

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

test('error for multiply requests', function (t) {
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
      t.equal(err, null);
      t.deepEqual(responses, [null, null, null]);

      node.close();
      node.once('close', t.end.bind(t));
    });
  });
});
