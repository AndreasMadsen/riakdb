'use strict';

var test = require('tap').test;
var async = require('async');
var endpoint = require('endpoint');

var RiakClient = require('../../lib/client.js');

var settings = {
  nodes: [{
    address: '127.0.0.1',
    port: 8087
  }]
};

var client;
test('start client', function (t) {
  client = new RiakClient(settings);
  client.connect();
  client.once('connect', t.end.bind(t));
});

var data = [
  'Alice was beginning to get very tired of sitting by her sister on the' +
  'bank, and of having nothing to do: once or twice she had peeped into the' +
  'book her sister was reading, but it had no pictures or conversations in' +
  'it, \'and what is the use of a book,\' thought Alice \'without pictures or' +
  'conversation?\'',

  'So she was considering in her own mind (as well as she could, for the' +
  'hot day made her feel very sleepy and stupid), whether the pleasure' +
  'of making a daisy-chain would be worth the trouble of getting up and' +
  'picking the daisies, when suddenly a White Rabbit with pink eyes ran' +
  'close by her.',

  'The rabbit-hole went straight on like a tunnel for some way, and then' +
  'dipped suddenly down, so suddenly that Alice had not a moment to think' +
  'about stopping herself before she found herself falling down a very deep' +
  'well.'
];

var bow = data.join(' ').toLowerCase().match(/\w*/g).map(function (w) {
  var o = {};
  if (w !== '') o[w] = 1;
  return o;
}).reduce(function (a, b) {
  Object.keys(b).map(function (w) {
    a[w] = (a[w] || 0) + 1;
  });
  return a;
});

var wordcount = data.map(function (sent) {
  return sent.toLowerCase().match(/\w*/g).length;
}).sort(function (a, b) { return a - b; });

test('populate database', function (t) {
  async.times(3, function (index, done) {
    client.low.put({
      bucket: new Buffer('riakdb-client-mapred'),
      key: new Buffer('key:' + index),
      content: {
        'value': new Buffer(data[index]),
        'charset': new Buffer('utf-8'),
        'content_type': new Buffer('text/plain')
      }
    }, done);
  }, function (err) {
    t.equal(err || null, null);
    t.end();
  });
});



test('client.mapred - count words in each part', function (t) {
  client.mapred({
    inputs: 'riakdb-client-mapred',
    query: [{
      map: {
        language: 'javascript',
        source: function(v) {
          return [ v.values[0].data.toLowerCase().match(/\w*/g).length ];
        }.toString()
      }
    }]
  }).pipe(endpoint({ objectMode: true }, function (err, response) {
    t.equal(err, null);

    response = response.sort(function (a, b) {
      return a.response - b.response;
    });

    t.deepEqual(response, [
      { phase: 0, response: wordcount[0] },
      { phase: 0, response: wordcount[1] },
      { phase: 0, response: wordcount[2] }
    ]);
    t.end();
  }));
});


test('client.mapred - create a bag of words object', function (t) {
  client.mapred({
    inputs: 'riakdb-client-mapred',
    query: [{
      map: {
        language: 'javascript',
        source: function(v) {
          var m = v.values[0].data.toLowerCase().match(/\w*/g);
          var r = [];
          for(var i in m) {
            if(m[i] !== '') {
              var o = {};
              o[m[i]] = 1;
              r.push(o);
            }
          }
          return r;
        }.toString()
      }
    }, {
      reduce: {
        language: 'javascript',
        source: function(v) {
          var r = {};
          for(var i in v) {
            for(var w in v[i]) {
              if(w in r) r[w] += v[i][w];
              else r[w] = v[i][w];
            }
          }
          return [r];
        }.toString()
      }
    }]
  }).pipe(endpoint({ objectMode: true }, function (err, response) {
    t.equal(err, null);

    t.deepEqual(response[0].response, bow);
    t.end();
  }));
});

test('cleanup database', function (t) {
  async.times(3, function (index, done) {
    client.low.del({
      bucket: 'riakdb-client-mapred',
      key: 'key:' + index
    }, done);
  }, function (err) {
    t.equal(err || null, null);
    t.end();
  });
});

test('= close client', function (t) {
  client.close();
  client.once('close', t.end.bind(t));
});
