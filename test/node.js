'use strict';

var test = require('tap').test;

var Node = require('../lib/node.js');
var types = require('../lib/types.js');

var settings = {
  timeout: 1000
};

test('open flag', function (t) {
  var node = new Node({
    address: '127.0.0.1',
    port: 8087
  }, settings);

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
  var node = new Node({
    address: '127.0.0.1',
    port: 8087
  }, settings);
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
  var node = new Node({
    address: '127.0.0.1',
    port: 8087
  }, settings);
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

test('stream');
