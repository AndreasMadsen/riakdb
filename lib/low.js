'use strict';

var util = require('util');
var stream = require('stream');
var events = require('events');
var extend = require('util-extend');

var protocol = require('./protocol.js');
var types = require('./types.js');
var jobs = require('./job.js');

var MessageJob = jobs.MessageJob;
var StreamJob = jobs.StreamJob;

function RiakClientLow(pool) {
  // RiakClient low don't use the events methods, but the RiakClient
  // inherits from this class and is an event emitter.
  events.EventEmitter.call(this);

  this._pool = pool;
  this._jobs = jobs;
}
util.inherits(RiakClientLow, events.EventEmitter);
module.exports = RiakClientLow;

RiakClientLow.prototype._message = function (type, data, callback) {
  this._pool.send(new MessageJob(type, data, callback));
};

RiakClientLow.prototype._stream = function (type, data) {
  var result = new stream.PassThrough({ objectMode: true, highWaterMark: 1 });
  this._pool.send(new StreamJob(type, data, result));
  return result;
};

// First a list of methods is defined using some short notation, the method
// function is then dynamically created by using the new Function constructor.
// NOTE: the setstream property is unused, but stays for later reference
var requestMethods = {
  // Bucket Operations
  getBuckets: { type: 'RpbListBucketsReq', response: 'stream', setstream: true },
  getKeys: { type: 'RpbListKeysReq', response: 'stream', setstream: false },
  getBucket: { type: 'RpbGetBucketReq', response: 'message' },
  setBucket: { type: 'RpbSetBucketReq', response: 'message' },
  resetBucket: { type: 'RpbResetBucketReq', response: 'message' },

  // Object/Key Operations
  get: { type: 'RpbGetReq', response: 'message' },
  put: { type: 'RpbPutReq', response: 'message' },
  del: { type: 'RpbDelReq', response: 'message' },

  // Query Operations
  mapred: { type: 'RpbMapRedReq', response: 'stream', setstream: false },
  getIndex: { type: 'RpbIndexReq', response: 'stream', setstream: true },
  search: { type: 'RpbSearchQueryReq', response: 'message' },

  // Server Operations
  ping: { type: 'RpbPingReq', response: 'message' },
  getServerInfo: { type: 'RpbGetServerInfoReq', response: 'message' },

  // Bucket Type Operations
  getBucketType: { type: 'RpbGetBucketTypeReq', response: 'message' },
  setBucketType: { type: 'RpbSetBucketTypeReq', response: 'message' },

  // Data Type Operations
  getCrdt: { type: 'DtFetchReq', response: 'message' },
  putCrdt: { type: 'DtUpdateReq', response: 'message' },

  // Yokozuna Operations
  delSearchIndex: { type: 'RpbYokozunaIndexDeleteReq', response: 'message' },
  getSearchIndex: { type: 'RpbYokozunaIndexGetReq', response: 'message' },
  putSearchIndex: { type: 'RpbYokozunaIndexPutReq', response: 'message' },
  getSearchSchema: { type: 'RpbYokozunaSchemaGetReq', response: 'message' },
  putSearchSchema: { type: 'RpbYokozunaSchemaPutReq', response: 'message' }
};

// Dynamically create the methods
Object.keys(requestMethods).forEach(function (methodName) {
  var info = requestMethods[methodName];
  var type = types[info.type];
  var response = info.response;
  var empty = !!protocol[type].empty;

  if (response === 'message') {
    if (empty) {
      RiakClientLow.prototype[methodName] = new Function(
        'callback', 'this._message(' + type + ', {}, callback);'
      );
    }
    else {
      RiakClientLow.prototype[methodName] = new Function(
        'data', 'callback', 'this._message(' + type + ', data, callback);'
      );
    }
  }
  else if (response === 'stream') {
    if (empty) {
      RiakClientLow.prototype[methodName] = new Function(
        'return this._stream(' + type + ', {});'
      );
    }
    else {
      RiakClientLow.prototype[methodName] = new Function(
        'data', 'return this._stream(' + type + ', data);'
      );
    }
  }
});
