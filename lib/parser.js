'use strict';

var stream = require('stream');
var util = require('util');

var protocol = require('./protocol.js');
var types = require('./types');

function MessageParser() {
  stream.Transform.call(this, { highWaterMark: 1 });
  this._readableState.objectMode = true;
  this._writableState.objectMode = false;

  this._buffer = new Buffer(0);
  this._awaitFrame = true;

  this._messageLength = 0;
  this._messageCode = 0;
}
util.inherits(MessageParser, stream.Transform);
module.exports = MessageParser;

MessageParser.prototype._transform = function (data, encodeing, callback) {
  // We should expect response buffers to be short, so there
  // is not reason not to concat with previouse tail buffer continuesly
  if (this._buffer.length > 0) {
    data = Buffer.concat([this._buffer, data]);
  }

  var offset = 0;
  // Expect multiply messages (eq. stream data)
  // Note there are other stop conditions, depending on the specefic state
  // but this must always be true, and should prevent any infinite loops
  while (offset < data.length) {

    // Require 5 bytes for frame
    if (this._awaitFrame) {
      if (data.length < 5 + offset) {
        // Check that slice length is > 0 and unshift remaining data
        this._buffer = data.slice(offset);
        break;
      }

      // State can be changed, read frame
      // Note message contains the message code, so substract one
      this._messageLength = data.readUInt32BE(0 + offset) - 1;
      this._messageCode = data.readUInt8(4 + offset);
      this._awaitFrame = false;
      offset += 5;
    }

    // Require message to be complete
    if (!this._awaitFrame) {
      if (data.length < offset + this._messageLength) {
        // Check that slice length is > 0 and unshift remaining data
        this._buffer = data.slice(offset);
        break;
      }

      // State can be changed, read message
      this.push(new Response(
        this._messageCode,
        data.slice(offset, offset + this._messageLength)
      ));
      offset += this._messageLength;
      this._awaitFrame = true;
    }
  }

  callback(null);
};

MessageParser.prototype._flush = function (callback) {
  callback(null);
};

function Response(type, content) {
  this.type = types.num2str[type];
  this.data = protocol[this.type].decode(content);
}
