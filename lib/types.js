'use strict';

var path = require('path');
var fs = require('fs');

var filepath = path.join(__dirname, 'riak_pb', 'src', 'riak_pb_messages.csv');
 var file = fs.readFileSync(filepath, 'utf8');

var types = {};

var lines = file.split('\n');
lines.forEach(function (line) {
  if (line === '') return;
  var vals = line.split(',');
  types[vals[1]] = parseInt(vals[0], 10);
});

module.exports = types;
