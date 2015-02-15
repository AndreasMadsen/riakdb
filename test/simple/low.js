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

test('Object/Key Operations', function (tt) {
  tt.test('test low.put method', function (t) {
    var client = new RiakClient(settings);
    client.connect();

    client.low.put({
      bucket: new Buffer('riakdb-client-test'),
      key: new Buffer('single key'),
      content: { value: new Buffer('single content') }
    }, function (err, response) {
      t.equal(err, null);
      t.deepEqual(response, { content: [], vclock: null, key: null });

      client.close();
      client.once('close', t.end.bind(t));
    });
  });

  tt.test('test low.put method', function (t) {
    var client = new RiakClient(settings);
    client.connect();

    client.low.get({
      bucket: new Buffer('riakdb-client-test'),
      key: new Buffer('single key')
    }, function (err, response) {
      t.equal(err, null);
      t.equal(response.content[0].value.toString(), 'single content');

      client.close();
      client.once('close', t.end.bind(t));
    });
  });

  tt.test('test low.put method', function (t) {
    var client = new RiakClient(settings);
    client.connect();

    client.low.del({
      bucket: new Buffer('riakdb-client-test'),
      key: new Buffer('single key')
    }, function (err, response) {
      t.equal(err, null);
      t.equal(response, null);

      client.close();
      client.once('close', t.end.bind(t));
    });
  });

  tt.end();
});
