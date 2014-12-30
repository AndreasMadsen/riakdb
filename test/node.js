'use strict';

var test = require('tap').test;
var async = require('async');

var Node = require('../lib/node.js');
var types = require('../lib/types.js');

var settings = {
  address: '127.0.0.1',
  port: 8087
};

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

    node.message(types.RpbPingReq, {}, function (err, data) {
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

    node.message(types.RpbPingReq, {}, function (err, data) {
      t.equal(err, null);
      t.equal(data, null);
      t.equal(error.message, 'node is in use');
      t.strictEqual(node.inuse, false);

      node.close();
      node.once('close', t.end.bind(t));
    });

    node.message(types.RpbPingReq, {}, function (err) {
      error = err;
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
      node.message(types.RpbPutReq, {
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
      node.message(types.RpbGetReq, {
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
