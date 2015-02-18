'use strict';

var util = require('util');
var stream = require('stream');

var Pool = require('./pool.js');
var jobs = require('./job.js');
var Low = require('./low.js');
var enums = require('./enums.js');

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
RiakClient.prototype.getKeys = function (req) {
  // Convert properties to buffers if not already buffers
  var request = {};
  if (req.timeout) request.timeout = req.timeout;
  if (req.bucket) request.bucket = toBuffer(req.bucket);
  if (req.type) request.type = toBuffer(req.type);

  // Depaginize response stream
  var result = new DepaginizeKeysStream();
  this._pool.send(new StreamJob('RpbListKeysReq', request, result));
  return result;
};

function toBuffer(maybeBuffer) {
  return Buffer.isBuffer(maybeBuffer) ? maybeBuffer : new Buffer(maybeBuffer);
}

function DepaginizeKeysStream() {
  stream.Transform.call(this, { objectMode: true, highWaterMark: 1 });
}
util.inherits(DepaginizeKeysStream, stream.Transform);

DepaginizeKeysStream.prototype._transform = function (data, encoding, done) {
  for (var i = 0; i < data.keys.length; i++) this.push(data.keys[i]);
  done(null);
};

DepaginizeKeysStream.prototype._flush = function (done) {
  done(null);
};
