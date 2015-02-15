'use strict';

var util = require('util');

var Pool = require('./pool.js');
var jobs = require('./job.js');
var Low = require('./low.js');
var enums = require('./enums.js');

var MessageJob = jobs.MessageJob;
var StreamJob = jobs.StreamJob;

function RiakClient(settings) {
  if (!(this instanceof RiakClient)) return new RiakClient(settings);
  Low.call(this, new Pool(settings));

  // Relay events
  this._pool.once('connect', this.emit.bind(this, 'connect'));
  this._pool.once('close', this.emit.bind(this, 'close'));
  this._pool.on('error', this.emit.bind(this, 'error'));

  // Create low level interface object
  this.low = new Low(this._pool);

  // Expose enum definitions
  this.enums = enums;
}
util.inherits(RiakClient, Low);
module.exports = RiakClient;

//
// Connection methods
//

RiakClient.prototype.connect = function () {
  this._pool.connect();
};

RiakClient.prototype.close = function () {
  this._pool.close();
};

//
// Request methods
//
