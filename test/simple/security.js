'use strict';

var test = require('tap').test;
var async = require('async');
var cp = require('child_process');

/*
var Node = require('../../lib/node.js');
var RiakClient = require('../../lib/client.js');

var nodes = [{
  address: '127.0.0.1',
  port: 8087
}];
*/

function exec(cmd, callback) {
  cp.exec(cmd, function (err, stdout, stderr) {
    if (err) return callback(err, null);
    if (stderr) return callback(new Error('stderr: ' + stderr));
    callback(null, stdout);
  });
}

test('enable security', function (t) {
  async.series([
    exec.bind(null, 'riak-admin security enable'),
    exec.bind(null, 'riak-admin security add-user riakdb password=testing'),
    exec.bind(null, 'riak-admin security grant riak_kv.put,riak_kv.get,riak_kv.delete on any to riakdb'),
    exec.bind(null, 'riak-admin security add-source riakdb 127.0.0.1/32 password')
  ], function (err, stdouts) {
    t.equal(err || null, null);
    t.ok(true, stdouts.join('; '));
    t.end();
  });
});

/*
test('simple', function (t) {
  var node = new Node(nodes[0], {
    user: new Buffer('riakdb'),
    password: new Buffer('testing')
  });
  node.connect();
  node.once('connect', function () {
    t.end();
  });
});

test('not authorized, error though callback', function (t) {
  var client = new RiakClient({ 'nodes': nodes });
  client.once('error', function (err) {
    console.log(err);
    // t.end();
  });

  client.ping(function (err, response) {
    console.log(err);
    // t.end();
  });
});

test('not authorized, error only though event', function (t) {
  var client = new RiakClient({ 'nodes': nodes, 'minConnections': 1 });
  client.once('error', function (err) {
    console.log(err);
    // t.end();
  });
});
*/

test('disable security', function (t) {
  exec('riak-admin security disable', function (err, stdout) {
    t.equal(err || null, null);
    t.ok(true, stdout);
    t.end();
  });
});
