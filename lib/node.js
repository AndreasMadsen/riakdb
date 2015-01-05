'use strict';

var net = require('net');
var util = require('util');
var events = require('events');
var stream = require('stream');

var types = require('./types.js');
var MessageParser = require('./parser.js');
var RiakError = require('./error.js');

function Node(addr) {
  events.EventEmitter.call(this);

  this.addr = addr;
  this.open = false;
  this.inuse = false;

  // Hold the current job, so socket errors can be relayed to the respective
  // stream or callback.
  this._job = null;

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

Node.prototype._used = function (job) {
  this.inuse = true;
  this._job = job;
  this.emit('used');
};

Node.prototype._free = function () {
  this.inuse = false;
  this._job = null;
  this.emit('free');
};

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

    self._parser.removeListener('error', onerror);

    self.open = false;
    self.emit('close');
  });

  // Handle socket error
  this._socket.on('error', onerror);
  this._parser.on('error', onerror);
  function onerror(error) {
    // Message is processing, emit error though the callback or stream
    if (self.inuse) {
      if (self._job.method === 'message') {
        self._job.callback(error, null);
      } else if (self._job.method === 'stream') {
        self._job.stream.emit('error', error);
        // Note that since we are in an error state, the node shouldn't be
        // made free. The socket close event is expected to follow.
      }
    }

    // Always emit connection error though the Node object, such they can
    // be collected on the RiakClient object.
    self.emit('error', error);
  }
};

Node.prototype.close = function () {
  this.open = false;
  this._socket.end();
};

Node.prototype._messageResponse = function (response, job) {
  this._free();

  if (response.type === types.RpbErrorResp) {
    job.callback(new RiakError(response), null);
  } else {
    job.callback(null, response.data);
  }
};

Node.prototype.message = function (job) {
  // The `message` method is used when it is known that there is a single
  // response from the riak cluster.
  // ! This method should only be called if the socket is open
  var self = this;

  // Fail at multiply request, though the client should make this impossible
  if (this.inuse) return job.callback(new Error('node is in use'), null);
  this._used(job);

  // Send job
  this._socket.write(job.buffer);

  // Await data from the parser
  this._parser.once('readable', function () {
    self._messageResponse(self._parser.read(1), job);
  });
};

Node.prototype._streamEnd = function (handler) {
  this._parser.unpipe(handler);
  this._free();
};

Node.prototype.stream = function (job) {
  // The `stream` method is used when there may be multiply responses, in any
  // case the last response must contain a `.done = true`.
  // ! This method should only be called if the socket is open

  // Fail at multiply request, though the client should make this impossible
  if (this.inuse) {
    process.nextTick(job.stream.emit.bind(job.stream, 'error', new Error('node is in use')));
    return;
  }
  this._used(job);

  // Send job
  this._socket.write(job.buffer);

  // Parse the data and relay any errors
  var handler = new MultiplyResponse(this);
  this._parser.pipe(handler).pipe(job.stream);
  handler.on('error', job.stream.emit.bind(job.stream, 'error'));
};

function MultiplyResponse(node) {
  stream.Transform.call(this, { objectMode: true, highWaterMark: 1 });

  this._node = node;
}
util.inherits(MultiplyResponse, stream.Transform);

MultiplyResponse.prototype._transform = function (response, encodeing, callback) {
  // If there is an error, emit that error and prevent future data
  if (response.type === types.RpbErrorResp) {
    this.emit('error', new RiakError(response));
    this._node._streamEnd(this);
  }
  // Not an error, just push the data and check when if the stream is completed
  else {
    this.push(response.data);
    if (response.data.done) this.end();
  }
  callback(null);
};

MultiplyResponse.prototype._flush = function (callback) {
  this._node._streamEnd(this);
  callback(null);
};
