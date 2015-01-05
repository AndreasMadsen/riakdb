'use strict';

var test = require('tap').test;
var async = require('async');
var endpoint = require('endpoint');
var PassThrough = require('stream').PassThrough;

var jobs = require('../../lib/job.js');
var Pool = require('../../lib/pool.js');
var types = require('../../lib/types.js');

var FakeRiak = require('../fake-riak.js');

var servers = [new FakeRiak(0x0BAD), new FakeRiak(0x1BAD)];
var settings = {
  nodes: [{
    address: '127.0.0.1',
    port: 0x0BAD
  }, {
    address: '127.0.0.1',
    port: 0x1BAD
  }]
};

var MessageJob = jobs.MessageJob;
function message(pool, type, data, callback) {
  pool.send(new MessageJob(type, data, callback));
}

var StreamJob = jobs.StreamJob;
function stream(pool, type, data) {
  var ret = new PassThrough({ objectMode: true, highWaterMark: 1 });
  pool.send(new StreamJob(type, data, ret));
  return ret;
}

test('create two fake servers', function (t) {
  async.each(servers, function (server, done) {
    server.listen();
    server.once('listening', done);
  }, t.end.bind(t));
});

test('with pool two multiply messages are possibol', function (t) {
  var pool = new Pool(settings);
  pool.connect();

  async.times(2, function (index, done) {
    message(pool, types.RpbPingReq, {}, done);
  }, function (err, responses) {
    t.equal(err, null);
    t.deepEqual(responses, [null, null]);

    // Internal tests
    t.equal(pool.connections, 2);

    pool.close();
    pool.once('close', t.end.bind(t));
  });
});

test('close the two fake servers', function (t) {
  async.each(servers, function (server, done) {
    server.close();
    server.once('close', done);
  }, t.end.bind(t));
});
