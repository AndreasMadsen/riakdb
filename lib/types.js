'use strict';

var path = require('path');
var fs = require('fs');

var filepath = path.join(__dirname, 'riak_pb', 'src', 'riak_pb_messages.csv');
var file = fs.readFileSync(filepath, 'utf8');

var str2num = {};
// Malloc String[256]
var num2str = Array(256).join(',').split(',');

var lines = file.split('\n');
lines.forEach(function (line) {
  if (line === '') return;
  var vals = line.split(',');
  var numcode = parseInt(vals[0], 10);
  var strcode = vals[1];

  num2str[numcode] = strcode;
  str2num[strcode] = numcode;
});

exports.str2num = str2num;
exports.num2str = num2str;
