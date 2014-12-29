'use strict';

var test = require('tap').test;

var Node = require('../lib/node.js');
var types = require('../lib/types.js');

var settings = {
  timeout: 1000
};

test('send', function (t) {
  var node = new Node({
    address: '127.0.0.1',
    port: 8087
  }, settings);

  node.once('connect', function () {

    node.send(types.RpbPingReq, {}, function (err, data) {
      t.equal(err, null);
      t.equal(data, null);

      node.close();
      node.once('close', t.end.bind(t));
    });
  });
});

test('stream');
