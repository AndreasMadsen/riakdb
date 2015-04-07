'use strict';

var test = require('tap').test;
var async = require('async');

var jobs = require('../../lib/job.js');
var Pool = require('../../lib/pool.js');

var FakeRiak = require('../fake-riak-cluster.js');

var cluster = new FakeRiak([0x0BAD, 0x1BAD]);
var settings = {
  nodes: [{
    host: '127.0.0.1',
    port: 0x0BAD
  }, {
    host: '127.0.0.1',
    port: 0x1BAD
  }]
};

var MessageJob = jobs.MessageJob;
function message(pool, type, data, callback) {
  pool.send(new MessageJob(type, data, callback));
}

test('create a fake cluster', function (t) {
  cluster.listen();
  cluster.once('listening', t.end.bind(t));
});

test('requests are queued before connecting', function (t) {
  var pool = new Pool(settings);

  var connectCalled = false;
  message(pool, 'RpbPingReq', {}, function (err, response) {
    t.equal(err, null);
    t.equal(response, null);
    t.equal(connectCalled, true);

    pool.close();
    pool.once('close', t.end.bind(t));
  });

  setTimeout(function () {
    connectCalled = true;
    pool.connect();
  }, 70);
});

test('requests will fail after closed', function (t) {
  var pool = new Pool(settings);
  pool.connect();

  message(pool, 'RpbPingReq', {}, function (err1, response1) {
    t.equal(err1, null);
    t.equal(response1, null);

    pool.close();
    message(pool, 'RpbPingReq', {}, function (err2, response2) {
      t.equal(err2.message, 'connection closed');
      t.equal(response2, null);

      pool.once('close', t.end.bind(t));
    });
  });
});

test('connections are reused', function (t) {
  var pool = new Pool(settings);
  pool.connect();

  async.timesSeries(2, function (index, done) {
    message(pool, 'RpbPingReq', {}, done);
  }, function (err, responses) {
    t.equal(err || null, null);
    t.deepEqual(responses, [null, null]);
    t.equal(pool.connections, 1);

    pool.close();
    pool.once('close', t.end.bind(t));
  });
});

test('with pool two simultaneous messages are possibol', function (t) {
  var pool = new Pool(settings);
  pool.connect();

  async.times(2, function (index, done) {
    message(pool, 'RpbPingReq', {}, done);
  }, function (err, responses) {
    t.equal(err || null, null);
    t.deepEqual(responses, [null, null]);
    t.equal(pool.connections, 2);

    pool.close();
    pool.once('close', t.end.bind(t));
  });
});

test('connections are restored on end', function (t) {
  var pool = new Pool({ minConnections: 1, nodes: settings.nodes });
  pool.connect();

  message(pool, 'RpbPingReq', {}, function (err, response) {
    t.equal(err, null);
    t.equal(response, null);

    cluster.testSocketEnd();
    setTimeout(function () {
      t.equal(pool.connections, 1);

      pool.close();
      pool.once('close', t.end.bind(t));
    }, 50);
  });
});

test('connections are restored on error', function (t) {
  // TODO: actually there is no error here, but I can't come up with
  // a simple way of simulating an error
  var pool = new Pool({ minConnections: 1, nodes: settings.nodes });
  pool.connect();

  message(pool, 'RpbPingReq', {}, function (err, response) {
    t.equal(err, null);
    t.equal(response, null);

    cluster.testSocketDestroy();
    setTimeout(function () {
      t.equal(pool.connections, 1);

      pool.close();
      pool.once('close', t.end.bind(t));
    }, 50);
  });
});

test('connect event with no minConnections', function (t) {
  var pool = new Pool(settings);

  pool.connect();
  var connected = false;
  pool.once('connect', function () {
    connected = true;
  });

  // the connect event should emit on nextTick so immediate should be safe
  setImmediate(function () {
    console.log('connect event');
    t.equal(connected, true);

    // Empty close
    pool.close();
    pool.once('close', t.end.bind(t));
  });
});

test('min connections are initialized at startup', function (t) {
  var pool = new Pool({ minConnections: 2, nodes: settings.nodes });
  pool.connect();

  pool.once('connect', function () {
    t.equal(pool.connections, 2);

    pool.close();
    pool.once('close', t.end.bind(t));
  });
});

test('no more nodes than max connections allow', function (t) {
  var pool = new Pool({ maxConnections: 5, nodes: settings.nodes });
  pool.connect();

  async.times(10, function (index, done) {
    message(pool, 'RpbPingReq', {}, done);
  }, function (err, responses) {
    t.equal(err || null, null);
    t.deepEqual(responses.length, 10);
    t.equal(pool.connections, 5);

    pool.close();
    pool.once('close', t.end.bind(t));
  });
});

test('if more than min connections, some closes after timeout', function (t) {
  var pool = new Pool({
    minConnections: 1,
    connectionTimeout: 100,
    nodes: settings.nodes
  });
  pool.connect();

  // TODO: replace with connection event
  pool.once('connect', initializeConnections);

  // Do 3 requests, such there will be 3 connections will be initialized
  function initializeConnections() {
    async.times(3, function (index, done) {
      message(pool, 'RpbPingReq', {}, done);
    }, function (err, responses) {
      t.equal(err || null, null);
      t.deepEqual(responses.length, 3);
      t.equal(pool.connections, 3);

      setTimeout(prolongConnections, 55);
    });
  }

  // Called after 50 ms, and do two requests such that only one connection
  // will close after 50 more ms.
  function prolongConnections() {
    t.equal(pool.connections, 3);

    async.times(2, function (index, done) {
      message(pool, 'RpbPingReq', {}, done);
    }, function (err, responses) {
      t.equal(err || null, null);
      t.deepEqual(responses.length, 2);
      t.equal(pool.connections, 3);

      setTimeout(firstClosed, 55);
    });
  }

  // Called after 100 ms, one connection should be closed
  function firstClosed() {
    t.equal(pool.connections, 2);
    setTimeout(lastClosed, 60);
  }

  // Called after 150 ms, only the minConnections should exists
  function lastClosed() {
    t.equal(pool.connections, 1);

    pool.close();
    pool.once('close', t.end.bind(t));
  }
});

test('close the fake cluster', function (t) {
  cluster.close();
  cluster.once('close', t.end.bind(t));
});
