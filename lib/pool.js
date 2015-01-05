'use strict';

var util = require('util');
var events = require('events');

var Node = require('./node.js');
var xorshift = require('xorshift');

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

  // TODO: implement timeout for connections
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

  // Monitor avaliable events
  connection.once('connect', function () {
    self._available += 1;
    self._drain();
  });
  connection.on('free', function () {
    self._available += 1;
    self._drain();
  });

  // Monitor not avaliable events
  connection.once('close', function () {
    // It is possibol to get a:
    // * free/connect event and then a close event
    // * used event and then a close event but without an free event
    // The `inuse` will determin in which situation the connection ended
    if (!this.inuse) self._available -= 1;

    // Remove connection from list and attempt to reconnect
    self._connections.splice(self._connections.indexOf(connection), 1);
    self.connections -= 1;
    self._addConnection();

    // Also cleanup the error relay
    connection.removeListener('error', onerror);

    // Emitt close event is there are no more connection and we are in a
    // closeing state.
    if (self._closeing && self._connections.length === 0) self.emit('close');
  });
  connection.on('used', function () {
    self._available -= 1;
  });

  // Relay error events
  connection.on('error', onerror);
  function onerror(err) {
    self.emit('error', err);
  }

  // Connect to the node
  connection.connect();
};

Pool.prototype._drain = function () {
  // Drain until all connections are in use or the queue is empty
  while (this._available > 0 && this._queue.length > 0) {
    var job = this._queue.shift();
    this._select()[job.method](job);
  }
};

Pool.prototype.send = function (job) {
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
  this._connected = true;

  // Initialize the minimum amount of connections, note it is entirely possibol
  // that `minConnection` is 0. In that case connections will first be made
  // when a request is made using the `.send` method.
  for (var i = 0; i < this._minConnections; i++) {
    this._addConnection();
  }
};

Pool.prototype.close = function () {
  // Set the closeing falg, this prevent the sockets from reconnecting. Then
  // end all active connections.
  this._closeing = true;
  for (var i = 0; i < this.connections; i++) {
    this._connections[i].close();
  }
};
