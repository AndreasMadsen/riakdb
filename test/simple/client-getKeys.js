'use strict';

var test = require('tap').test;
var async = require('async');
var endpoint = require('endpoint');

var RiakClient = require('../../lib/client.js');

var settings = {
  nodes: [{
    address: '127.0.0.1',
    port: 8087
  }]
};

var client;
test('start client', function (t) {
  client = new RiakClient(settings);
  client.connect();
  client.once('connect', t.end.bind(t));
});

test('populate database', function (t) {
  async.times(10, function (index, done) {
    client.low.put({
      bucket: new Buffer('riakdb-client-getkeys'),
      key: new Buffer('key:' + index),
      content: {
        'value': new Buffer('value:' + index)
      }
    }, done);
  }, function (err) {
    t.equal(err || null, null);
    t.end();
  });
});

test('client.getKeys', function (t) {
  client.getKeys({ bucket: 'riakdb-client-getkeys' })
    .pipe(endpoint({ objectMode: true }, function (err, keys) {
      t.equal(err, null);
      t.equal(keys.length, 10);

      for (var ia = 0; ia < 10; ia++) {
        t.ok(Buffer.isBuffer(keys[ia]), 'item is buffer');
      }

      keys = keys.map(function (key) { return key.toString(); }).sort();

      for (var ib = 0; ib < 10; ib++) {
        t.equal(keys[ib], 'key:' + ib);
      }

      t.end();
    }));
});

test('cleanup database', function (t) {
  async.times(10 || null, function (index, done) {
    client.low.del({
      bucket: new Buffer('riakdb-client-getkeys'),
      key: new Buffer('key:' + index)
    }, done);
  }, function (err) {
    t.equal(err || null, null);
    t.end();
  });
});

test('close client', function (t) {
  client.close();
  client.once('close', t.end.bind(t));
});
