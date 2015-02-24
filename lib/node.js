'use strict';

var net = require('net');
var tls = require('tls');
var util = require('util');
var events = require('events');
var stream = require('stream');

var MessageParser = require('./parser.js');
var RiakError = require('./error.js');
var MessageJob = require('./job.js').MessageJob;

function Node(addr, auth) {
  events.EventEmitter.call(this);
  var self = this;

  this.addr = addr;
  this.open = false;
  this.inuse = false;
  this.lastRequest = Date.now();

  // Hold the current job, so socket errors can be relayed to the respective
  // stream or callback.
  this._job = null;
  this._auth = auth;

  // Socket setup
  this._socket = new net.Socket();
  this._parser = new MessageParser();
  // Disable the Nagle algorithm, as sugested by the riak documentation:
  // https://github.com/basho/basho_docs/blob/master/source/
  // ... languages/en/riak/dev/references/client-implementation.md
  this._socket.setNoDelay(true);

  // Create handler function, these just serves as .bind to the _onEvent methods
  this._errorHandler = function (error) {
    self._onError(error);
  };
  this._closeHandler = function (hadError) {
    self._onClose(hadError);
  };
}
util.inherits(Node, events.EventEmitter);
module.exports = Node;

Node.prototype._used = function (job) {
  this.inuse = true;
  // It is not nessarry to set `lastRequest` here since inuse is true
  this._job = job;
  this.emit('used');
};

Node.prototype._free = function () {
  this.inuse = false;
  this.lastRequest = Date.now();
  this._job = null;
  this.emit('free');
};

Node.prototype.connect = function () {
  var self = this;

  this._socket.connect(this.addr);
  this._socket.once('close', this._closeHandler);
  this._socket.once('error', onerror);
  this._socket.pipe(this._parser);

  var stop = false;
  function onerror(error) {
    stop = true;
    self._onError(error);
  }

  // Wait for the socket to connect
  this._socket.once('connect', function () {
    if (stop) return;
    self._socket.removeListener('error', onerror);

    // No auth, so connection is done
    if (!self._auth) {
      self._connectionDone();
    }
    // Perform auth
    else {
      self._performHandshake(function (err) {
        if (err) return self._onError(err);
        self._connectionDone();
      });
    }
  });

  // TODO: when there is a connection error, the pool expects a close event
  // but currectly this does not happen.
};

Node.prototype._performHandshake = function (callback) {
  var self = this;
  var startTLS, authReq;

  var cleartext = this._socket;
  var cryptotext;

  var stop = false;
  cleartext.once('error', onerror);
  function onerror(err) {
    stop = true;
    callback(err);
  }

  // Ask riak to prepear for a TLS handshake
  startTLS = new MessageJob('RpbStartTls', {}, function (err) {
    console.log('start TLS');
    if (stop) return undefined;
    if (err) return callback(err);

    // Create secure connection
    cryptotext = tls.connect({
      socket: cleartext,
      rejectUnauthorized: false
    });

    // switch parser
    cleartext.unpipe(self._parser);
    //cryptotext.pipe(self._parser);

    // swtich error handler
    cleartext.removeListener('error', onerror);
    cryptotext.once('error', onerror);

    // Wait for secure connection and send auth
    cryptotext.once('secureConnect', function () {
      self._handshakeMessage(cryptotext, authReq);
    });
  });

  // Perform authorization
  authReq = new MessageJob('RpbAuthReq', self._auth, function (err) {
    if (stop) return undefined;
    if (err) return callback(err);

    // no error was returned, thus the auth was good.
    cryptotext.removeListener('error', onerror);
    self._socket = cryptotext;
    callback(null);
  });

  self._handshakeMessage(cleartext, startTLS);
};

Node.prototype._handshakeMessage = function (socket, job) {
  var self = this;
  // This is a simpler version of the this.message method,
  // it doesn't emit events set itself up as a job. So it
  // doesn't get socket errors.

  socket.write(job.buffer);
  this._parser.once('readable', function () {
    var response = self._parser.read();

    if (response.type === 'RpbErrorResp') {
      job.callback(new RiakError(response), null);
    } else {
      job.callback(null, response.data);
    }
  });
};

Node.prototype._connectionDone = function () {
  this.open = true;
  this.emit('connect');

  // Handle socket error
  this._parser.on('error', this._errorHandler);
  this._socket.on('error', this._errorHandler);
};

Node.prototype._onClose = function (hadError) {
  this._socket.unpipe(this._parser);
  this._socket.removeListener('error', this._errorHandler);

  this._parser.removeListener('error', this._errorHandler);

  // In case there was no error, the callback or stream will be hanging,
  // to prevent this emit an close error.
  if (!hadError && this.inuse) this._job.error(new Error('connection closed'));

  this.open = false;
  this.emit('close', hadError);
};

Node.prototype._onError = function (error) {
  // If a request is processing, emit error though the callback or stream
  if (this.inuse) this._job.error(error);

  // Always emit connection error though the Node object, such they can
  // be collected on the RiakClient object.
  this.emit('error', error);

  // Note that since we are in an error state, the node shouldn't be
  // made free. The socket close event is expected to follow.
};

Node.prototype.close = function () {
  this.open = false;
  this._socket.end();
};

Node.prototype._messageResponse = function (response, job) {
  this._free();

  if (response.type === 'RpbErrorResp') {
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
  this._parser.once('readable', function readable() {
    var msg = self._parser.read(1);
    if (msg === null) self._parser.once('readable', readable);
    else self._messageResponse(msg, job);
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
  // Note that if the socket closes, this won't qualify as a "successful done"
  // event, only a `.done === true` can do this. Instead an error will be emitted
  // though the `job.stream` by the `socke.once('close')` event handler.
  var handler = new MultiplyResponse(this);
  this._parser.pipe(handler, { end: false }).pipe(job.stream);
  handler.on('error', job.stream.emit.bind(job.stream, 'error'));
};

function MultiplyResponse(node) {
  stream.Transform.call(this, { objectMode: true, highWaterMark: 1 });

  this._node = node;
}
util.inherits(MultiplyResponse, stream.Transform);

MultiplyResponse.prototype._transform = function (response, encodeing, callback) {
  // If there is an error, emit that error and prevent future data
  if (response.type === 'RpbErrorResp') {
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
