#riakdb

> Simple riak client

## Installation

```sheel
npm install riakdb
```

## Example

```javascript
var riakdb = require('riakdb');
var client = riakdb({
  nodes: [
    address: '127.0.0.1',
    port: 8087
  ]
});

client.connect();
client.getKeys({ bucket: 'examples' })
  .on('data', function (key) {
    console.log(key);
  })
  .once('end', function () {
    client.close();
  });
```

## Documentation

The documentation is separated intro three parts:

**[Connection](#connection)**

Discusses how to setup and configure the Riak connection pool and the
associated events.

**[High level interface](#high-level-interface)**

`riakdb` comes with two interfaces for communicating with Riak. Generally there
is no difference, however in some cases a convenient abstraction is put around
the underlying low level interace, to make it easier to use.

An example of this is the `.keys(request)` (stream of all keys in bucket). In
this case Riak returns a paginated stream, meaning that each item can contain
multiply keys. The high level interface performs a depagination such that each
item contain just a single key.

Because of the wast amount of features in Riak, some high level methods may
not support all the features of the corresponding low level method.

**[Low level interface](#low-level-interface)**

To give better backward compatibility and ensure that all features in Riak
are supported a low level interface is also provided. This is a direct mapping
to the [Riak protocol buffer](http://docs.basho.com/riak/latest/dev/references/protocol-buffers/)
definition, with nothing on top. This uses the
[protocol-buffers](https://github.com/mafintosh/protocol-buffers) module, so
the encoding and decoding behaviour is defined by that.

### Connection

#### client = RiakClient(settings)

```javascript
var riakdb = require('riakdb');

var client = riakdb({
  nodes: [
    address: '127.0.0.1',
    port: 8087
  ]
});

client.connect();
```

#### client.connect()

```javascript
client.connect();
```

#### client.close()

```javascript
client.close();
```

#### client.on('connect')

#### client.on('close')

#### client.on('error')

### High level interface

TODO: Implement `.keys` as a high level example and document

### Low level interface

The low level interface have two response types `callback` and `stream`. In
both cases the function takes a `request` object as the first argument. There
are a few exceptions/details to this pattern:

* In some cases there (e.q. `ping`) is no request parameters and thus
there is no `request` argument.

* Some stream requests, requires you to set a request parameter there makes
Riak return a stream and not a single message. These are marked with `stream (set)`.

**Example on a `callback` response with a request `argument`**

```javascript
client.low.get({
  key: new Buffer('some key'),
  bucket: new Buffer('some bucket')
}, function (err, response) {
  // response is contains the full content
});
```

**Example on a `callback` response with no `request` argument**

```javascript
client.low.ping(function (err, response) {
  // response is null as there is also no response for `.ping`
});
```

**Example on a `stream` response with a request `argument`**

```javascript
client.low.getKeys({
  bucket: new Buffer('some bucket')
}).pipe(output);
```

**Example on a `stream` response with a required stream parameter**

```javascript
client.low.getBuckets({
  stream: true
}).pipe(output);
```

**Full list of methods**

This is a complete list of [all the documented Riak requests](http://docs.basho.com/riak/latest/dev/references/protocol-buffers/),
with a mapping to the _method name_, _response type_ and link to the
request and response structure (_protocol_).

| Name                       | Method            | Response Type     | Protocol |
| -------------------------- | ----------------- | ----------------- | -------- |
| **Bucket Operations**      |                   |                   |
| List Buckets               | `getBuckets`      | stream (set)      | [RpbListBucketsReq](http://docs.basho.com/riak/latest/dev/references/protocol-buffers/list-buckets/)
| List Keys                  | `getKeys`         | stream            | [RpbListKeysReq](http://docs.basho.com/riak/latest/dev/references/protocol-buffers/list-keys/)
| Get Bucket Properties      | `getBucket`       | callback          | [RpbGetBucketReq](http://docs.basho.com/riak/latest/dev/references/protocol-buffers/get-bucket-props/)
| Set Bucket Properties      | `setBucket`       | callback          | [RpbSetBucketReq](http://docs.basho.com/riak/latest/dev/references/protocol-buffers/set-bucket-props/)
| Reset Bucket Properties    | `resetBucket`     | callback          | [RpbResetBucketReq](http://docs.basho.com/riak/latest/dev/references/protocol-buffers/reset-bucket-props/)
| **Object/Key Operations**  |                   |                   |
| Fetch Object               | `get`             | callback          | [RpbGetReq](http://docs.basho.com/riak/latest/dev/references/protocol-buffers/fetch-object/)
| Store Object               | `put`             | callback          | [RpbPutReq](http://docs.basho.com/riak/latest/dev/references/protocol-buffers/store-object/)
| Delete Object              | `del`             | callback          | [RpbDelReq](http://docs.basho.com/riak/latest/dev/references/protocol-buffers/delete-object/)
| **Query Operations**       |                   |                   |
| MapReduce                  | `mapred`          | stream            | [RpbMapRedReq](http://docs.basho.com/riak/latest/dev/references/protocol-buffers/mapreduce/)
| Secondary Indexes          | `getIndex`        | stream (set)      | [RpbIndexReq](http://docs.basho.com/riak/latest/dev/references/protocol-buffers/secondary-indexes/)
| Search                     | `search`          | callback          | [RpbSearchQueryReq](http://docs.basho.com/riak/latest/dev/references/protocol-buffers/search/)
| **Server Operations**      |                   |                   |
| Ping                       | `ping`            | callback          | [RpbPingReq](http://docs.basho.com/riak/latest/dev/references/protocol-buffers/ping/)
| Server Info                | `getServerInfo`   | callback          | [RpbGetServerInfoReq](http://docs.basho.com/riak/latest/dev/references/protocol-buffers/server-info/)
| **Bucket Type Operations** |                   |                   |
| Get Bucket Type            | `getBucketType`   | callback          | [RpbGetBucketTypeReq](http://docs.basho.com/riak/latest/dev/references/protocol-buffers/get-bucket-type/)
| Set Bucket Type            | `setBucketType`   | callback          | [RpbSetBucketTypeReq](http://docs.basho.com/riak/latest/dev/references/protocol-buffers/set-bucket-type/)
| **Data Type Operations**   |                   |                   |
| Data Type Fetch            | `getCrdt`         | callback          | [DtFetchReq](http://docs.basho.com/riak/latest/dev/references/protocol-buffers/dt-fetch/)
| Data Type Union            | not implemented   | callback          | [DtOp](http://docs.basho.com/riak/latest/dev/references/protocol-buffers/dt-union/)
| Data Type Store            | `putCrdt`         | callback          | [DtUpdateReq](http://docs.basho.com/riak/latest/dev/references/protocol-buffers/dt-store/)
| Data Type Counter Store    | not implemented   | callback          | [CounterOp](http://docs.basho.com/riak/latest/dev/references/protocol-buffers/dt-counter-store/)
| Data Type Set Store        | not implemented   | callback          | [SetOp](http://docs.basho.com/riak/latest/dev/references/protocol-buffers/dt-set-store/)
| Data Type Map Store        | not implemented   | callback          | [MapOp](http://docs.basho.com/riak/latest/dev/references/protocol-buffers/dt-map-store/)
| **Yokozuna Operations**    |                   |                   |
| Yokozuna Index Get         | `getSearchIndex`  | callback          | [RpbYokozunaIndexGetReq](http://docs.basho.com/riak/latest/dev/references/protocol-buffers/yz-index-get/)
| Yokozuna Index Put         | `putSearchIndex`  | callback          | [RpbYokozunaIndexPutReq](http://docs.basho.com/riak/latest/dev/references/protocol-buffers/yz-index-put/)
| Yokozuna Index Delete      | `delSearchIndex`  | callback          | [RpbYokozunaIndexDeleteReq](http://docs.basho.com/riak/latest/dev/references/protocol-buffers/yz-index-delete/)
| Yokozuna Schema Get        | `getSearchSchema` | callback          | [RpbYokozunaSchemaGetReq](http://docs.basho.com/riak/latest/dev/references/protocol-buffers/yz-schema-get/)
| Yokozuna Schema Put        | `putSearchSchema` | callback          | [RpbYokozunaSchemaPutReq](http://docs.basho.com/riak/latest/dev/references/protocol-buffers/yz-schema-put/)

## License

**This software is licensed under "MIT"**

> Copyright (c) 2015 Andreas Madsen
>
> Permission is hereby granted, free of charge, to any person obtaining a copy
> of this software and associated documentation files (the "Software"), to deal
> in the Software without restriction, including without limitation the rights
> to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
> copies of the Software, and to permit persons to whom the Software is
> furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in
> all copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
> IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
> FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
> AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
> LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
> OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
> THE SOFTWARE.
