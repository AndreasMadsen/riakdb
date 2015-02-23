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
  async.times(100, function (index, done) {
    client.low.put({
      bucket: new Buffer('riakdb-client-getindex'),
      key: new Buffer('key:' + index),
      content: {
        'value': new Buffer('value:' + index),
        'charset': new Buffer('utf-8'),
        'content_type': new Buffer('application/json'),
        'indexes': [
          { key: new Buffer('2i_bin'), value: new Buffer(Math.floor(index / 10).toString()) }
        ]
      }
    }, done);
  }, function (err) {
    t.equal(err || null, null);
    t.end();
  });
});

test('continuation not supported', function (t) {
  var err1 = null;
  try {
    client.getIndex({ qtype: 'eq', 'max_results': 10 });
  } catch (e) {
    err1 = e;
  }

  var err2 = null;
  try {
    client.getIndex({ qtype: 'eq', continuation: true });
  } catch (e) {
    err2 = e;
  }

  t.equal(err1.message, 'continuation is not supported, use low level interface');
  t.equal(err1.name, 'Error');

  t.equal(err2.message, 'continuation is not supported, use low level interface');
  t.equal(err2.name, 'Error');

  t.end();
});

test('client.getIndex - equal', function (t) {
  client.getIndex({
    bucket: 'riakdb-client-getindex',
    index: '2i_bin',
    qtype: 'eq',
    'key': '2'
  }).pipe(endpoint({ objectMode: true }, function (err, response) {
    t.equal(err, null);

    response = response.map(function (key) {
      return key.toString();
    }).sort(function (a, b) { return a.localeCompare(b); });

    var expected = [];
    for (var i = 20; i < 30; i++) {
      expected.push('key:' + i);
    }

    t.deepEqual(response, expected);
    t.end();
  }));
});

test('client.getIndex - range, without terms', function (t) {
  client.getIndex({
    bucket: 'riakdb-client-getindex',
    index: '2i_bin',
    qtype: 'range', // testing enum-string
    'range_min': '2',
    'range_max': '5'
  }).pipe(endpoint({ objectMode: true }, function (err, response) {
    t.equal(err, null);

    response = response.map(function (key) {
      return key.toString();
    }).sort(function (a, b) { return a.localeCompare(b); });

    var expected = [];
    for (var i = 20; i < 60; i++) {
      expected.push('key:' + i);
    }

    t.deepEqual(response, expected);
    t.end();
  }));
});

test('client.getIndex - range, with terms', function (t) {
  client.getIndex({
    bucket: 'riakdb-client-getindex',
    index: '2i_bin',
    qtype: client.enums.IndexQueryType.range, // testing enum-number
    'return_terms': true,
    'range_min': '2',
    'range_max': '5'
  }).pipe(endpoint({ objectMode: true }, function (err, response) {
    t.equal(err, null);

    response = response.map(function (item) {
      return {
        key: item.key.toString(),
        value: item.value.toString()
      };
    }).sort(function (a, b) { return a.value.localeCompare(b.value); });

    var expected = [];
    for (var i = 20; i < 60; i++) {
      expected.push({
        key: Math.floor(i / 10).toString(), // 2i value
        value: 'key:' + i // item key
      });
    }

    t.deepEqual(response, expected);
    t.end();
  }));
});

test('cleanup database', function (t) {
  async.times(100, function (index, done) {
    client.low.del({
      bucket: 'riakdb-client-getindex',
      key: 'key:' + index
    }, done);
  }, function (err) {
    t.equal(err || null, null);
    t.end();
  });
});

test('= close client', function (t) {
  client.close();
  client.once('close', t.end.bind(t));
});
