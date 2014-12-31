'use strict';

var test = require('tap').test;
var endpoint = require('endpoint');

var protocol = require('../lib/protocol.js');
var MessageParser = require('../lib/parser.js');

function constructMessage(type, data) {
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

function buffer2str(val) {
  if (Buffer.isBuffer(val)) return val.toString();
  else if (val === null || typeof val !== 'object') return val;
  else if (Array.isArray(val)) {
    return val.map(buffer2str);
  } else {
    var obj = {};
    Object.keys(val).forEach(function (key) {
      obj[key] = buffer2str(val[key]);
    });

    return obj;
  }
}

test('no messages', function (t) {
  var parser = new MessageParser();

  parser.pipe(endpoint({ objectMode: true }, function (err, items) {
    t.equal(err, null);
    t.equal(items.length, 0);
    t.end();
  }));

  parser.end();
});

test('one empty messages', function (t) {
  var parser = new MessageParser();

  parser.pipe(endpoint({ objectMode: true }, function (err, items) {
    t.equal(err, null);
    t.deepEqual(buffer2str(items), [{
      type: 2,
      data: null
    }]);
    t.end();
  }));

  parser.write(new Buffer([0, 0, 0, 1, 2]));
  parser.end();
});

test('one complete message', function (t) {
  var parser = new MessageParser();

  parser.once('readable', function () {
    t.deepEqual(buffer2str(parser.read()), {
      type: 0,
      data: {
        errmsg: 'message complete',
        errcode: 1
      }
    });

    parser.once('readable', t.fail.bind(t, 'readable should only fire once'));
    parser.once('end', t.end.bind(t));
    parser.end();
  });

  parser.write(constructMessage(0, {
    errmsg: new Buffer('message complete'),
    errcode: 1
  }));
});

test('partial frame', function (t) {
  var parser = new MessageParser();

  parser.pipe(endpoint({ objectMode: true }, function (err, items) {
    t.equal(err, null);
    t.deepEqual(buffer2str(items), [{
      type: 0,
      data: {
        errmsg: 'message complete',
        errcode: 1
      }
    }]);
    t.end();
  }));

  var buffer = constructMessage(0, {
    errmsg: new Buffer('message complete'),
    errcode: 1
  });

  parser.write(buffer.slice(0, 4));
  parser.write(buffer.slice(4, 5));
  parser.write(buffer.slice(5));
  parser.end();
});

test('partial message', function (t) {
  var parser = new MessageParser();

  parser.pipe(endpoint({ objectMode: true }, function (err, items) {
    t.equal(err, null);
    t.deepEqual(buffer2str(items), [{
      type: 0,
      data: {
        errmsg: 'message complete',
        errcode: 1
      }
    }]);
    t.end();
  }));

  var buffer = constructMessage(0, {
    errmsg: new Buffer('message complete'),
    errcode: 1
  });

  parser.write(buffer.slice(0, 7));
  parser.write(buffer.slice(7));
  parser.end();
});

test('two complete message', function (t) {
  var parser = new MessageParser();

  parser.pipe(endpoint({ objectMode: true }, function (err, items) {
    t.equal(err, null);
    t.deepEqual(buffer2str(items), [{
      type: 0,
      data: {
        errmsg: 'message complete A',
        errcode: 1
      }
    }, {
      type: 0,
      data: {
        errmsg: 'message complete B',
        errcode: 1
      }
    }]);
    t.end();
  }));

  var bufferA = constructMessage(0, {
    errmsg: new Buffer('message complete A'),
    errcode: 1
  });

  var bufferB = constructMessage(0, {
    errmsg: new Buffer('message complete B'),
    errcode: 1
  });

  parser.write(Buffer.concat([bufferA, bufferB]));
  parser.end();
});

test('multiply messages (regression)', function (t) {
  var parser = new MessageParser();

  parser.pipe(endpoint({ objectMode: true }, function (err, items) {
    t.equal(err, null);
    t.deepEqual(buffer2str(items), [{
      type: 18,
      data: {
        keys: ['A'],
        done: false
      }
    }, {
      type: 18,
      data: {
        keys: ['B'],
        done: false
      }
    }, {
      type: 18,
      data: {
        keys: ['C'],
        done: false
      }
    }, {
      type: 18,
      data: {
        keys: [],
        done: true
      }
    }]);
    t.end();
  }));

  parser.write(new Buffer([0x00, 0x00, 0x00, 0x04, 0x12, 0x0a, 0x01, 0x41]));
  parser.write(new Buffer([0x00, 0x00, 0x00, 0x04, 0x12, 0x0a, 0x01, 0x42,
                           0x00, 0x00, 0x00, 0x04, 0x12, 0x0a, 0x01, 0x43,
                           0x00, 0x00, 0x00, 0x03, 0x12, 0x10, 0x01      ]));

  parser.end();
});
