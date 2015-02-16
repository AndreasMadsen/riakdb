'use strict';

var protocol = require('./protocol.js');
var types = require('./types.js');

function MessageJob(type, data, callback) {
  this.method = 'message';
  this.type = type;
  this.buffer = encode(type, data);
  this.callback = callback;
}
exports.MessageJob = MessageJob;

MessageJob.prototype.error = function (error) {
  this.callback(error, null);
};

function StreamJob(type, data, stream) {
  this.method = 'stream';
  this.type = type;
  this.buffer = encode(type, data);
  this.stream = stream;
}
exports.StreamJob = StreamJob;

StreamJob.prototype.error = function (error) {
  this.stream.emit('error', error);
};

function encode(type, data) {
  // Create message
  var length = protocol[type].encodingLength(data) + 1;
  var buffer = new Buffer(4 + length);
  // message length
  buffer.writeUInt32BE(length, 0, true);
  // message code
  buffer.writeUInt8(types.str2num[type], 4, true);
  // message content
  protocol[type].encode(data, buffer, 5);

  return buffer;
}
