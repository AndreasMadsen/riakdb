'use strict';

var util = require('util');

function RiakError(response) {
  Error.captureStackTrace(this, RiakError);
  Object.defineProperty(this, 'message', {
    value: response.data.errmsg.toString(),
    configurable: true,
    writable: true
  });
  this.code = response.data.errcode;
}
util.inherits(RiakError, Error);
module.exports = RiakError;

RiakError.prototype.name = 'Riak Error';

// TODO: format errors
// http://docs.basho.com/riak/latest/ops/running/recovery/errors/
