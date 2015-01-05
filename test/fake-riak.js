'use strict';

var net = require('net');
var util = require('util');
var events = require('events');

var types = require('../lib/types.js');
var protocol = require('../lib/protocol.js');
var MessageParser = require('../lib/parser.js');

function FakeRiak(port) {
  events.EventEmitter.call(this);

  this.port = port;
  this.connections = 0;
  this._server = new net.Server();
  this._server.once('listening', this.emit.bind(this, 'listening'));
  this._server.once('close', this.emit.bind(this, 'close'));
  this._server.on('connection', this._connection.bind(this));
}
util.inherits(FakeRiak, events.EventEmitter);
module.exports = FakeRiak;

FakeRiak.prototype._connection = function (socket) {
  var self = this;

  // Diable Nagle Algorithm
  socket.setNoDelay(true);

  // Maintain connection counter
  this.connections += 1;
  socket.once('close', function () {
    self.connections -= 1;
  });

  // Handle requests
  var inuse = false;
  socket.pipe(new MessageParser()).on('data', function (request) {
    // Fail on multiply requests
    if (inuse) {
      socket.write(encode(types.RpbErrorResp, {
        errmsg: new Buffer('Multply requests not supported'),
        errcode: 0
      }));
      return;
    }

    // Handle ping request, make a small delay
    if (request.type === types.RpbPingReq) {
      socket.write(encode(types.RpbPingResp, {}), function () {
        inuse = false;
      });
    }
  });
};

function encode(type, data) {
  // Create message
  var length = protocol[type].encodingLength(data) + 1;
  var buffer = new Buffer(4 + length);
  // message length
  buffer.writeUInt32BE(length, 0, true);
  // message size
  buffer.writeUInt8(type, 4, true);
  // message content
  protocol[type].encode(data, buffer, 5);

  return buffer;
}

FakeRiak.prototype.listen = function () {
  this._server.listen(this.port, '127.0.0.1');
};

FakeRiak.prototype.close = function () {
  this._server.close();
};
