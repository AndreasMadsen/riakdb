'use strict';

var util = require('util');
var events = require('events');
var async = require('async');

var FakeRiakServer = require('./fake-riak-server.js');

function FakeRiakCluster(ports) {
  events.EventEmitter.call(this);

  this._servers = [];
  for (var i = 0; i < ports.length; i++) {
    this._servers.push(new FakeRiakServer(ports[i]));
  }
}
util.inherits(FakeRiakCluster, events.EventEmitter);
module.exports = FakeRiakCluster;

FakeRiakCluster.prototype._getSockets = function () {
  return Array.prototype.concat.apply(
    [], this._servers.map(function (server) { return server.sockets; })
  );
};

FakeRiakCluster.prototype.testSocketEnd = function () {
  this._getSockets()[0].end();
};

FakeRiakCluster.prototype.testSocketDestroy = function () {
  this._getSockets()[0].destroy();
};

FakeRiakCluster.prototype.listen = function () {
  var self = this;

  async.each(this._servers, function (server, done) {
    server.listen();
    server.once('listening', done);
  }, function () {
    self.emit('listening');
  });
};

FakeRiakCluster.prototype.close = function () {
  var self = this;

  async.each(this._servers, function (server, done) {
    server.once('close', done);
    server.close();
  }, function () {
    self.emit('close');
  });
};
