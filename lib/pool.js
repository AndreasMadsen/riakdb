'use strict';

var util = require('util');
var events = require('events');

var async = require('async');
var xorshift = require('xorshift');

var Node = require('./node.js');

function Pool(settings) {
  events.EventEmitter.call(this);

  // Connection counter mostly for testing and debugging
  this.connections = 0;

  // Pool states
  this._connected = false;
  this._closeing = false;

  // Job stacks
  this._inprogress = [];
  this._queue = [];

  // Connection and node information holders
  this._available = 0;
  this._connections = [];
  this._addrs = settings.nodes;

  // Setup settings and defaults
  this._minConnections = settings.minConnections || 0;
  this._maxConnections = settings.maxConnections || 20;
  this._connectionTimeout = settings.connectionTimeout || 60000; // 1 min
}
util.inherits(Pool, events.EventEmitter);
module.exports = Pool;

Pool.prototype._select = function () {
  // This method should only be called if there are active nodes

  // Filter the connections so only the connections there aren't in use and
  // open is can be selected.
  var actives = [];
  for (var i = 0; i < this.connections; i++) {
    var connection = this._connections[i];
    if (!connection.inuse && connection.open) {
      actives.push(connection);
    }
  }

  // Select a random node
  return actives[Math.floor(xorshift.random() * actives.length)];
};

Pool.prototype._addConnection = function () {
  var self = this;
  // Prevent adding connection if in a closeing state or .connect isn't called
  if (this._closeing || !this._connected) return;
  // Prevent more than max allowed connections to be created
  if (this.connections >= this._maxConnections) return;

  // Get connection settings for a random riak node
  var addr = this._addrs[Math.floor(xorshift.random() * this._addrs.length)];
  var connection = new Node(addr);
  this._connections.push(connection);
  this.connections += 1;

  // Handle timeout
  var timeout = setTimeout(ontimeout, this._connectionTimeout);
  function ontimeout() {
    var timePassed = Date.now() - connection.lastRequest;

    // If connection is in use or there don't appear to come a reason to close
    // it, then wait the full amount of time
    if (connection.inuse || self.connections <= self._minConnections) {
      timeout = setTimeout(ontimeout, self._connectionTimeout);
    }
    // For some time there haven't been a request, but not enogth time have
    // passed. Wait the remaining time (+15 ms for uncertainty) and check again.
    else if (timePassed < self._connectionTimeout) {
      timeout = setTimeout(ontimeout, (self._connectionTimeout - timePassed) + 15);
    }
    // The required time have passed, close the connection.
    else if (connection.open) {
      self._closeConnection(connection);
    }
  }

  // Monitor avaliable events
  connection.once('connect', function () {
    self._available += 1;
    self._drain();
  });

  connection.on('free', onfree);
  function onfree() {
    self._available += 1;
    self._drain();
  }

  // Monitor not avaliable events
  connection.once('close', function (hadError) {
    // It is possibol to get a:
    // * free/connect event and then a close event
    // * used event and then a close event but without an free event
    // The `inuse` will determin in which situation the connection ended
    if (!this.inuse) self._available -= 1;

    // Remove connection from list
    var index = self._connections.indexOf(connection);
    if (index !== -1) {
      self._connections.splice(index, 1);
      self.connections -= 1;
    }
    // attempt to reconnect
    if (hadError || self.connections < self._minConnections) {
      self._addConnection();
    }

    // Stop timeout handler
    clearTimeout(timeout);

    // Also cleanup the event handlers
    connection.removeListener('error', onerror);
    connection.removeListener('free', onfree);
    connection.removeListener('used', onused);

    // Emitt close event is there are no more connection and we are in a
    // closeing state.
    if (self._closeing && self.connections === 0) self.emit('close');
  });

  connection.on('used', onused);
  function onused() {
    self._available -= 1;
  }

  // Relay error events
  connection.on('error', onerror);
  function onerror(err) {
    self.emit('error', err);
  }

  // Connect to the node
  connection.connect();
};

Pool.prototype._closeConnection = function (connection) {
  // Remove connection from list and close
  var index = this._connections.indexOf(connection);
  if (index !== -1) {
    this._connections.splice(index, 1);
    this.connections -= 1;
  }
  connection.close();
};

Pool.prototype._drain = function () {
  // Drain until all connections are in use or the queue is empty
  while (this._available > 0 && this._queue.length > 0) {
    var job = this._queue.shift();
    this._select()[job.method](job);
  }
};

Pool.prototype.send = function (job) {
  // If closeing emit an error and stop
  if (this._closeing) return job.error(new Error('connection closed'));

  // If there are available node select one, otherwise push to qute and
  // attempt to create a connection, though the max connection limit might
  // prevent this.
  if (this._available > 0) {
    this._select()[job.method](job);
  } else {
    this._queue.push(job);
    this._addConnection();
  }
};

Pool.prototype.connect = function () {
  var self = this;
  this._connected = true;

  // Initialize the minimum amount of connections, note it is entirely possibol
  // that `minConnection` is 0. In that case connections will first be made
  // when a request is made using the `.send` method. Also if there are a queue
  // create connection, such it can be drained.
  var sockets = Math.max(this._queue.length, this._minConnections);
  for (var i = 0; i < sockets; i++) {
    this._addConnection();
  }

  // Wait for minConnections workers to connect and the emit the connect event
  async.each(
    this._connections.slice(0, this._minConnections),
    function (connection, done) {
      connection.once('connect', done);
    },
    function () {
      process.nextTick(self.emit.bind(self, 'connect'));
    }
  );
};

Pool.prototype.close = function () {
  // Set the closeing falg, this prevent the sockets from reconnecting. Then
  // end all active connections.
  this._closeing = true;

  // There are no connections so the node.on('close') handler is not going
  // to emit the close event. Force it here, and skip closeing the connections
  // connections (there are non).
  if (this.connections === 0) {
    return process.nextTick(this.emit.bind(this, 'close'));
  }

  // A copy if the connection list is required since `closeConnection` will
  // splice the list
  this._connections.slice(0).forEach(this._closeConnection, this);
};
