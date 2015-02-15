'use strict';

var fs = require('fs');
var path = require('path');
var protobuf = require('protocol-buffers');

var types = require('./types.js');

// Create a string `source` containing all the protocol buffer definitions
// for riak.
var dir = path.resolve(__dirname, 'riak_pb', 'src');
var source = fs.readdirSync(dir)
  .filter(function (filename) {
    return (path.extname(filename) === '.proto');
  })
  .map(function (filename) {
    return fs.readFileSync(path.join(dir, filename));
  })
  .join('\n')
  .replace(/option java_.+/g, '')
  .replace(/import .+/g, '');

// Parse and export messages
var messages = protobuf(source);
var schemas = [];
Object.keys(types).forEach(function (name) {
  var id = types[name];

  if (name in messages) {
    schemas[id] = messages[name];
  } else {
    schemas[id] = {
      type: 2,
      message: true,
      empty: true,
      buffer: true,
      name: name,
      encode: function () { return; },
      decode: function () { return null; },
      encodingLength: function () { return 0; }
    };
  }
});

module.exports = schemas;
