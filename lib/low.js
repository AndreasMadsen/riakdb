'use strict';

var util = require('util');
var stream = require('stream');
var events = require('events');

var protocol = require('./protocol.js');
var types = require('./types.js');
var jobs = require('./job.js');

function RiakClientLow(pool) {
  // RiakClient low don't use the events methods, but the RiakClient
  // inherits from this class and is an event emitter.
  events.EventEmitter.call(this);

  this._pool = pool;
  this._jobs = jobs;
}
util.inherits(RiakClientLow, events.EventEmitter);
module.exports = RiakClientLow;

// First a list of methods is defined using some short notation, the method
// function is then dynamically created by using the new Function constructor.
var requestMethods = {
  // Bucket Operations
  getBuckets: { type: 'RpbListBucketsReq', response: 'message' },
  getKeys: { type: 'RpbListKeysReq', response: 'stream' },
  getBucket: { type: 'RpbGetBucketReq', response: 'message' },
  setBucket: { type: 'RpbSetBucketReq', response: 'message' },
  resetBucket: { type: 'RpbResetBucketReq', response: 'message' },

  // Object/Key Operations
  get: { type: 'RpbGetReq', response: 'message' },
  put: { type: 'RpbPutReq', response: 'message' },
  del: { type: 'RpbDelReq', response: 'message' },

  // Query Operations
  mapred: { type: 'RpbMapRedReq', response: 'stream' },
  getIndex: { type: 'RpbIndexReq', response: 'stream' },
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
        'callback', code(function ($1, callback) {
          this._pool.send(new this._jobs.MessageJob($1, {}, callback));
      }, type));
    }
    else {
      RiakClientLow.prototype[methodName] = new Function(
        'data', 'callback', code(function ($1, data, callback) {
          this._pool.send(new this._jobs.MessageJob($1, data, callback));
      }, type));
    }
  }
  else if (response === 'stream') {
    if (empty) {
      RiakClientLow.prototype[methodName] = new Function(
        code(function ($1) {
          var result = new stream.PassThrough({ objectMode: true, highWaterMark: 1 });
          this._pool.send(new this._jobs.StreamJob($1, {}, result));
          return result;
      }, type));
    }
    else {
      RiakClientLow.prototype[methodName] = new Function(
        'data', code(function ($1, data) {
          var result = new stream.PassThrough({ objectMode: true, highWaterMark: 1 });
          this._pool.send(new this._jobs.StreamJob($1, data, result));
          return result;
      }, type));
    }
  }
});

// Extract code from function and allow an extra parameter ($1)
function code(fn, $1) {
  return fn.toString().split('\n').slice(1, -1).join('\n').replace('$1', $1);
}
