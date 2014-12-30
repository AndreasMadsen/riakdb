'use strict';

var net = require('net');
var util = require('util');
var events = require('events');

var types = require('./types.js');
var protocol = require('./protocol.js');
var MessageParser = require('./parser.js');

function Node(addr) {
  events.EventEmitter.call(this);

  this.addr = addr;
  this.open = false;
  this.closeing = false;

  // Maintain failure rate
  this._failures = 0.0;
  this._total = 0.0;
  this.failureRate = 0.0;

  // Socket setup
  this._socket = new net.Socket();
  this._parser = new MessageParser();
  this._socket.pipe(this._parser);
  // Disable the Nagle algorithm, as sugested by the riak documentation:
  // https://github.com/basho/basho_docs/blob/master/source/
  // ... languages/en/riak/dev/references/client-implementation.md
  this._socket.setNoDelay(true);
}
util.inherits(Node, events.EventEmitter);
module.exports = Node;

Node.prototype.connect = function () {
  var self = this;

  this._socket.connect(this.addr);

  // Handle socket open
  this._socket.once('connect', function () {
    self.open = true;
    self.emit('connect');
  });

  // Handle socket close and cleanup
  this._socket.once('close', function () {
    self._socket.unpipe(self._parser);
    self._socket.removeListener('error', onerror);

    self._parser.removeAllListeners('data');
    self._parser.removeListener('error', onerror);

    self.open = false;
    self.emit('close');
  });

  // Handle socket error
  this._socket.on('error', onerror);
  this._parser.on('error', onerror);
  function onerror(error) {
    // TODO: how shoud be count error, pr request or by connection
    self._failures += 1;
    self._failureRate = self._failure / self._total;
    self.emit('error', error);
  }
};

Node.prototype.close = function () {
  if (this.closeing) return;
  this.closeing = true;
  this.open = false;
  this._socket.end();
};

Node.prototype._message = function (response, callback) {
  if (response.type === types.RpbErrorResp) {
    var error = new Error('riak error');
    error.data = response.data;
    callback(error, null);
  } else {
    callback(null, response.data);
  }
};

Node.prototype.message = function (type, data, callback) {
  // This method should only be called if the socket is open
  var self = this;

  // Assume the socket isn't going to fail. If it fails, the failure counter
  // will be updated later.
  this._total += 1;
  this._failureRate = this._failure / this._total;

  // Create message
  var length = protocol[type].encodingLength(data);
  var buffer = new Buffer(5 + length);
  // message length
  buffer.writeUInt32BE(length + 1, 0, true);
  // message size
  buffer.writeUInt8(type, 4, true);
  // message content
  protocol[type].encode(data, buffer, 5);

  // Await response
  this._parser.once('data', function (response) {
    self._message(response, callback);
  });
  // Send
  this._socket.write(buffer);
};
