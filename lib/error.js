'use strict';

var util = require('util');

function RiakError(response) {
  Error.captureStackTrace(this, RiakError);
  this.message = response.data.errmsg.toString();
  this.code = response.data.errcode;
}
util.inherits(RiakError, Error);
module.exports = RiakError;

RiakError.prototype.name = 'Riak Error';
