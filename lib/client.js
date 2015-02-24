'use strict';

var util = require('util');
var stream = require('stream');
var extend = require('util-extend');

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
RiakClient.prototype.getIndex = function (req) {
  // Add stream property to object and copy
  req = extend({ stream: true }, req);
  // Map strings to enum number
  var qtype = req.qtype;
  req.qtype = (typeof qtype === 'number' ? qtype : enums.IndexQueryType[qtype]);

  // continuation is not supported
  if (req.hasOwnProperty('max_results') || req.hasOwnProperty('continuation')) {
    throw new Error('continuation is not supported, use low level interface');
  }

  // If return_terms is true, (2i value, item key) pairs are is in the `results`
  // array. Otherwise keys are in the `keys` array.
  var result = new DepaginizeStream(req.return_terms ? 'results' : 'keys');
  this._pool.send(new StreamJob('RpbIndexReq', req, result));
  return result;
};

RiakClient.prototype.getKeys = function (req) {
  // Depaginize response stream
  var result = new DepaginizeStream('keys');
  this._pool.send(new StreamJob('RpbListKeysReq', req, result));
  return result;
};

RiakClient.prototype.mapred = function (req) {
  var request = {
    'request': new Buffer(JSON.stringify(req)),
    'content_type': new Buffer('application/json')
  };

  var result = new UnpackMapReduceStream();
  this._pool.send(new StreamJob('RpbMapRedReq', request, result));
  return result;
};

// Parse MapReduce response stream
function UnpackMapReduceStream() {
  stream.Transform.call(this, { objectMode: true, highWaterMark: 1 });
}
util.inherits(UnpackMapReduceStream, stream.Transform);

UnpackMapReduceStream.prototype._transform = function (data, encoding, done) {
  var response = data.response === null ? [] : JSON.parse(data.response);
  for (var i = 0; i < response.length; i++) {
    this.push({
      'phase': data.phase,
      'response': response[i]
    });
  }

  done(null);
};

UnpackMapReduceStream.prototype._flush = function (done) {
  done(null);
};

//
// Depaginize a stream of objects, with some `property` containing an array of
// results
//
function DepaginizeStream(property) {
  stream.Transform.call(this, { objectMode: true, highWaterMark: 1 });

  this._property = property;
}
util.inherits(DepaginizeStream, stream.Transform);

DepaginizeStream.prototype._transform = function (response, encoding, done) {
  var items = response[this._property];
  for (var i = 0; i < items.length; i++) {
    this.push(items[i]);
  }

  done(null);
};

DepaginizeStream.prototype._flush = function (done) {
  done(null);
};
