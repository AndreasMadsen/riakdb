'use strict';

var protocol = require('./protocol.js');

var enums = {};
var ignore = [
  'type', 'message', 'name', 'buffer', 'empty',
  'encode', 'decode', 'encodingLength'
];
Object.keys(protocol).forEach(function (name) {
  var schema = protocol[name];
  Object.keys(schema)
    .filter(function (key) {
      return ignore.indexOf(key) === -1;
    })
    .forEach(function (key) {
      enums[key] = schema[key];
    });
});

module.exports = enums;
