'use strict';

var test = require('tap').test;
var async = require('async');
var mappoint = require('mappoint');
var endpoint = require('endpoint');

var RiakClient = require('../../lib/client.js');

var settings = {
  nodes: [{
    address: '127.0.0.1',
    port: 8087
  }]
};

var client;
test('= start client', function (t) {
  client = new RiakClient(settings);
  client.connect();
  client.once('connect', t.end.bind(t));
});

test('= Object/Key Operations - part 1/2', function (tt) {
  tt.test('low.put', function (t) {
    client.low.put({
      bucket: new Buffer('riakdb-low-test'),
      key: new Buffer('single key'),
      content: {
        'value': new Buffer('single content'),
        'charset': new Buffer('utf-8'),
        'content_type': new Buffer('text/plain'),
        'indexes': [
          { key: new Buffer('2i_bin'), value: new Buffer('2i value') }
        ]
      }
    }, function (err, response) {
      t.equal(err, null);
      t.deepEqual(response, { content: [], vclock: null, key: null });
      t.end();
    });
  });

  tt.test('low.get', function (t) {
    client.low.get({
      bucket: new Buffer('riakdb-low-test'),
      key: new Buffer('single key')
    }, function (err, response) {
      t.equal(err, null);
      t.equal(response.content[0].value.toString(), 'single content');
      t.end();
    });
  });

  tt.end();
});

test('= Bucket Operations', function (tt) {
  tt.test('low.getBuckets', function (t) {
    client.low.getBuckets({ stream: true })
      .pipe(mappoint({ objectMode: true }, function (data, done) {
        done(null, data.buckets.map(function (bucket) {
          return bucket.toString();
        }));
      }))
      .pipe(endpoint({ objectMode: true }, function (err, response) {
        t.equal(err, null);
        var buckets = Array.prototype.concat.apply([], response);
        t.ok(buckets.indexOf('riakdb-low-test') !== -1, 'bucket exists');
        t.end();
      }));
  });

  tt.test('low.getKeys', function (t) {
    client.low.getKeys({ bucket: new Buffer('riakdb-low-test') })
      .pipe(mappoint({ objectMode: true }, function (data, done) {
        done(null, data.keys.map(function (key) {
          return key.toString();
        }));
      }))
      .pipe(endpoint({ objectMode: true }, function (err, response) {
        t.equal(err, null);
        var keys = Array.prototype.concat.apply([], response);
        t.deepEqual(keys, ['single key']);
        t.end();
      }));
  });

  tt.test('low.getBucket', function (t) {
    client.low.getBucket({
      bucket: new Buffer('riakdb-low-test')
    }, function (err, response) {
      t.equal(err, null);
      t.equal(response.props.allow_mult, false);
      t.end();
    });
  });

  tt.test('low.setBucket', function (t) {
    client.low.setBucket({
      bucket: new Buffer('riakdb-low-test'),
      props: { 'allow_mult': true }
    }, function (err1, response1) {
      t.equal(err1, null);
      t.equal(response1, null);

      client.low.getBucket({
        bucket: new Buffer('riakdb-low-test')
      }, function (err2, response2) {
        t.equal(err2, null);
        t.equal(response2.props.allow_mult, true);
        t.end();
      });
    });
  });

  tt.test('low.resetBucket', function (t) {
    client.low.resetBucket({
      bucket: new Buffer('riakdb-low-test')
    }, function (err1, response1) {
      t.equal(err1, null);
      t.equal(response1, null);

      client.low.getBucket({
        bucket: new Buffer('riakdb-low-test')
      }, function (err2, response2) {
        t.equal(err2, null);
        t.equal(response2.props.allow_mult, false);
        t.end();
      });
    });
  });

  tt.end();
});

test('= Query Operations', function (tt) {
  tt.test('low.mapred', function (t) {
    client.low.mapred({
      'content_type': new Buffer('application/json'),
      'request': new Buffer(JSON.stringify({
        inputs: 'riakdb-low-test',
        query: [{
          map: {
            name: 'Riak.mapValues',
            language: 'javascript'
          }
        }]
      }))
    })
    .pipe(mappoint({ objectMode: true }, function (data, done) {
      if (data.done) return done(null, []);
      return done(null, JSON.parse(data.response.toString()));
    }))
    .pipe(endpoint({ objectMode: true }, function (err, response) {
      t.equal(err, null);
      var buckets = Array.prototype.concat.apply([], response);
      t.deepEqual(buckets, ['single content']);
      t.end();
    }));
  });

  tt.test('low.getIndex', function (t) {
    client.low.getIndex({
      stream: true,
      bucket: new Buffer('riakdb-low-test'),
      index: new Buffer('2i_bin'),
      qtype: client.enums.IndexQueryType.eq,
      key: new Buffer('2i value')
    })
    .pipe(mappoint({ objectMode: true }, function (data, done) {
      done(null, data.keys.map(function (key) {
        return key.toString();
      }));
    }))
    .pipe(endpoint({ objectMode: true }, function (err, response) {
      t.equal(err, null);
      var keys = Array.prototype.concat.apply([], response);
      t.deepEqual(keys, ['single key']);
      t.end();
    }));
  });

  tt.test('low.search', function (t) {
    t.end();
  });

  tt.end();
});

test('= Server Operations', function (tt) {
  tt.test('low.ping', function (t) {
    client.low.ping(function (err, response) {
      t.equal(err, null);
      t.equal(response, null);
      t.end();
    });
  });

  tt.test('low.getServerInfo', function (t) {
    client.low.getServerInfo(function (err, response) {
      t.equal(err, null);
      t.equal(response.node.toString(), 'riak@127.0.0.1');
      t.end();
    });
  });

  tt.end();
});

test('= Object/Key Operations - part 2/2', function (tt) {
  tt.test('low.del', function (t) {
    client.low.del({
      bucket: new Buffer('riakdb-low-test'),
      key: new Buffer('single key')
    }, function (err, response) {
      t.equal(err, null);
      t.equal(response, null);
      t.end();
    });
  });

  tt.end();
});

test('= close client', function (t) {
  client.close();
  client.once('close', t.end.bind(t));
});
