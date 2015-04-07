'use strict';

var test = require('tap').test;

var RiakClient = require('../../lib/client.js');

var settings = {
  nodes: [{
    host: '127.0.0.1',
    port: 8087
  }]
};

test('connect and close events', function (t) {
  var client = new RiakClient(settings);

  client.connect();
  client.once('connect', function () {
    client.close();
    client.once('close', t.end.bind(t));
  });
});

test('client inherits from low level if no special definition', function (t) {
  var client = new RiakClient(settings);
  client.connect();

  client.ping(function (err, response) {
    t.equal(err, null);
    t.deepEqual(response, null);
    client.close();
    client.once('close', t.end.bind(t));
  });
});
