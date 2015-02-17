'use strict';

var test = require('tap').test;
var path = require('path');
var fs = require('fs');
var mappoint = require('mappoint');
var endpoint = require('endpoint');

var RiakClient = require('../../lib/client.js');

var schema = fs.readFileSync(path.resolve(__dirname, '../fixture/schema.xml'));
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

var itemValue = JSON.stringify({ key1: 'test', key2: 'abc 123' });
test('= Object/Key Operations - part 1/2', function (tt) {
  tt.test('low.put', function (t) {
    client.low.put({
      bucket: new Buffer('riakdb-low-test'),
      key: new Buffer('single key'),
      content: {
        'value': new Buffer(itemValue),
        'charset': new Buffer('utf-8'),
        'content_type': new Buffer('application/json'),
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
      t.equal(response.content[0].value.toString(), itemValue);
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

test('= Yokozuna Operations - part 1/2', function (tt) {
  tt.test('low.putSearchSchema', function (t) {
    client.low.putSearchSchema({
      schema: {
        name: new Buffer('riakdb-low-schema'),
        content: schema
      }
    }, function (err, response) {
      t.equal(err, null);
      t.deepEqual(response, { content: [], vclock: null, key: null });

      t.end();
    });
  });

  tt.test('low.getSearchSchema', function (t) {
    client.low.getSearchSchema({
      name: new Buffer('riakdb-low-schema')
    }, function (err, response) {
      t.equal(err, null);
      t.equal(response.schema.name.toString(), 'riakdb-low-schema');
      t.equal(response.schema.content.toString(), schema.toString());

      t.end();
    });
  });

  tt.test('low.putSearchIndex', function (t) {
    client.low.putSearchIndex({
      index: {
        name: new Buffer('riakdb-low-search'),
        schema: new Buffer('riakdb-low-schema')
      }
    }, function (err, response) {
      t.equal(err, null);
      t.deepEqual(response, { content: [], vclock: null, key: null });
      t.end();
    });
  });

  tt.test('low.getSearchIndex', function (t) {
    (function retry() {
      client.low.getSearchIndex({
        name: new Buffer('riakdb-low-search')
      }, function (err, response) {
        // It takes some time for riak to catch up on a search index
        if ((err && err.message === 'notfound') || response.index.length === 0) {
          return setTimeout(retry, 100);
        }

        t.equal(err, null);
        t.equal(response.index[0].name.toString(), 'riakdb-low-search');
        t.equal(response.index[0].schema.toString(), 'riakdb-low-schema');
        t.end();
      });
    })();
  });

  tt.test('enable search index', function (t) {
    client.low.setBucket({
      bucket: new Buffer('riakdb-low-test'),
      props: {
          'search_index': new Buffer('riakdb-low-search')
      }
    }, function (err, response) {
      t.equal(err, null);
      t.equal(response, null);
      t.end();
    });
  });

  tt.test('refresh bucket', function (t) {
    client.low.get({
      bucket: new Buffer('riakdb-low-test'),
      key: new Buffer('single key')
    }, function (err1, response1) {
      t.equal(err1, null);
      t.type(response1.content[0], 'object');
      client.low.put({
        bucket: new Buffer('riakdb-low-test'),
        key: new Buffer('single key'),
        content: response1.content[0]
      }, function (err2, response2) {
        t.equal(err2, null);
        t.deepEqual(response2, { content: [], vclock: null, key: null });
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
      t.deepEqual(buckets, [itemValue]);
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
    (function retry() {
      client.low.search({
        q: new Buffer('key1:test AND key2:abc'),
        index: new Buffer('riakdb-low-search')
      }, function (err, response) {
        if (response.docs.length === 0) return setTimeout(retry, 100);
        t.equal(err, null);
        t.equal(response.num_found, 1);
        t.equal(response.docs.length, 1);

        var fields = response.docs[0].fields.map(function (item) {
          return { key: item.key.toString(), value: item.value.toString() };
        }).sort(function (a, b) {
          return a.key > b.key;
        });

        t.deepEqual(fields[1], { key: '_yz_rb', value: 'riakdb-low-test' });
        t.deepEqual(fields[2], { key: '_yz_rk', value: 'single key' });
        t.deepEqual(fields[3], { key: '_yz_rt', value: 'default' });
        t.deepEqual(fields[4], { key: 'key1', value: 'test' });
        t.deepEqual(fields[5], { key: 'key2', value: 'abc 123' });

        t.end();
      });
    })();
  });

  tt.end();
});

test('= Yokozuna Operations - part 2/2', function (tt) {
  tt.test('disable search index', function (t) {
    client.low.resetBucket({
      bucket: new Buffer('riakdb-low-test')
    }, function (err, response) {
      t.equal(err, null);
      t.equal(response, null);
      t.end();
    });
  });

  tt.test('low.delSearchSchema', function (t) {
    client.low.delSearchIndex({
      name: new Buffer('riakdb-low-search')
    }, function (err, response) {
      t.equal(err, null);
      t.equal(response, null);
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

// Remember to create and active the bucket type used for testing
// riak-admin bucket-type create riakdb-low-buckettype \
//    '{"props": {"allow_mult": true, "datatype": "counter"}}'
// riak-admin bucket-type activate riakdb-low-buckettype
test('= Bucket Type Operations', function (tt) {
  tt.test('low.setBucketType', function (t) {
    client.low.setBucketType({
      type: new Buffer('riakdb-low-buckettype'),
      props: {
        'n_val': 4
      }
    }, function (err, response) {
      t.equal(err, null);
      t.equal(response, null);
      t.end();
    });
  });

  tt.test('low.getBucketType', function (t) {
    client.low.getBucketType({
      type: new Buffer('riakdb-low-buckettype')
    }, function (err, response) {
      t.equal(err, null);
      t.equal(response.props.n_val, 4);
      t.end();
    });
  });

  tt.test('reset bucket type', function (t) {
    client.low.setBucketType({
      type: new Buffer('riakdb-low-buckettype'),
      props: {
        'n_val': 3
      }
    }, function (err, response) {
      t.equal(err, null);
      t.equal(response, null);
      t.end();
    });
  });

  tt.end();
});

test('= Data Type Operations', function (tt) {
  tt.test('low.putCrdt', function (t) {
    client.low.putCrdt({
      bucket: new Buffer('riakdb-low-test'),
      type: new Buffer('riakdb-low-buckettype'),
      key: new Buffer('counter'),
      op: {
        'counter_op': { increment: 1 }
      }
    }, function (err, response) {
      t.equal(err, null);
      t.deepEqual(response, {
        'key': null,
        'context': null,
        'counter_value': 0,
        'set_value': [],
        'map_value': []
      });
      t.end();
    });
  });

  tt.test('low.getCrdt', function (t) {
    client.low.getCrdt({
      bucket: new Buffer('riakdb-low-test'),
      type: new Buffer('riakdb-low-buckettype'),
      key: new Buffer('counter')
    }, function (err, response) {
      t.equal(err, null);
      t.deepEqual(response, {
        context: null,
        type: 1,
        value: {
          'counter_value': 1,
          'set_value': [],
          'map_value': []
        }
      });
      t.end();
    });
  });

  tt.test('delete counter', function (t) {
    client.low.del({
      bucket: new Buffer('riakdb-low-test'),
      type: new Buffer('riakdb-low-buckettype'),
      key: new Buffer('counter')
    }, function (err, response) {
      t.equal(err, null);
      t.equal(response, null);
      t.end();
    });
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

test('= close client', function (t) {
  client.close();
  client.once('close', t.end.bind(t));
});
