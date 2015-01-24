'use strict';

var protocol = require('./protocol.js');

function MessageJob(type, data, callback) {
  this.method = 'message';
  this.type = type;
  this.buffer = encode(type, data);
  this.callback = callback;
}
exports.MessageJob = MessageJob;

function StreamJob(type, data, stream) {
  this.method = 'stream';
  this.type = type;
  this.buffer = encode(type, data);
  this.stream = stream;
}
exports.StreamJob = StreamJob;

function encode(type, data) {
  // Create message
  var length = protocol[type].encodingLength(data) + 1;
  var buffer = new Buffer(4 + length);
  // message length
  buffer.writeUInt32BE(length, 0, true);
  // message size
  buffer.writeUInt8(type, 4, true);
  // message content
  protocol[type].encode(data, buffer, 5);

  return buffer;
}