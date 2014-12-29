'use strict';

var net = require('net');
var util = require('util');
var events = require('events');

var types = require('./types.js');
var protocol = require('./protocol.js');
var MessageParser = require('./parser.js');

function Node(addr, settings) {
  events.EventEmitter.call(this);

  this.addr = addr;
  this.open = false;
  this.closeing = false;

  // Maintain failure rate
  this._failures = 0.0;
  this._total = 0.0;
  this.failureRate = 0.0;

  // Socket settings and holder
  this._socket = null;
  this._timeout = settings.timeout;

  // nocallback is used as a callback holder after the request/response dialog
  // is completed.
  this._nocallback = function () {
    this.emit('error', new Error('did not expect message'));
  };
  this._callback = this._nocallback;

  // Begin connection
  this._connect();
}
util.inherits(Node, events.EventEmitter);
module.exports = Node;

Node.prototype._connect = function () {
  var self = this;

  this._socket = net.connect(this.addr);
  // Disable the Nagle algorithm, as sugested by the riak documentation:
  // https://github.com/basho/basho_docs/blob/master/source/
  // ... languages/en/riak/dev/references/client-implementation.md
  this._socket.setNoDelay(true);
  this._socket.once('connect', function () {
    self.open = true;
    self.emit('connect');
  });

  // Parse messages encoded by message size prefix
  var parser = new MessageParser();
  this._socket.pipe(parser);
  parser.on('data', ondata);
  function ondata(response) {
    self._message(response);
  }

  // Handle socket closeing
  this._socket.once('close', function () {
    self.open = false;
    self._socket.unpipe(parser);
    self._socket.removeListener('error', onerror);
    self._socket.removeListener('data', ondata);

    if (self.closeing) return self.emit('close');

    setTimeout(function () {
      if (!self.closeing) self._connect();
    }, self.timeout);
  });

  // Handle socket error
  this._socket.on('error', onerror);
  function onerror(error) {
    // TODO: how shoud be count error, pr request or by connection
    self._failures += 1;
    self._failureRate = self._failure / self._total;
    self.emit('error', error);
  }
};

Node.prototype._message = function (response) {
  if (response.type === types.RpbErrorResp) {
    var error = new Error('riak error');
        error.data = response.data;
    this._callback(error, null);
  } else {
    this._callback(null, response.data);
  }

  this._callback = this._nocallback;
};

Node.prototype.close = function () {
  if (this.closeing) return;
  this.closeing = true;
  this.open = false;
  this._socket.end();
};

Node.prototype.send = function (type, data, callback) {
  // This method should only be called if the socket is open

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

  // Send
  this._socket.write(buffer);
  // Await response
  this._callback = callback;
};
