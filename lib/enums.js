'use strict';

var protocol = require('./protocol.js');
var types = require('./types.js');

var enums = {};

var ignore = [
  'type', 'message', 'name', 'buffer', 'empty',
  'encode', 'decode', 'encodingLength'
];
Object.keys(types).forEach(function (name) {
  var schema = protocol[types[name]];
  Object.keys(schema)
    .filter(function (key) {
      return ignore.indexOf(key) === -1;
    })
    .forEach(function (key) {
      enums[key] = schema[key];
    });
});

module.exports = enums;
