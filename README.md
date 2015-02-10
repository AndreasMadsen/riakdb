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
client.keys({ bucket: 'examples' })
  .on('data', function (key) {
    console.log(key);
  })
  .once('end', function () {
    client.close();
  });

```

## Documentation

The documentation is separated intro three parts:

**[Connection](#Connection)**

Discusses how to setup and configure the riak connection pool and the
associated events.

**[High level interface](#High-level-interface)**

`riakdb` comes with two interfaces for communicating with Riak. Generally there
is no difference, however in some cases a convenient abstraction is put around
the underlying low level interace, to make it easier to use.

An example of this is the `.keys(request)` (stream of all keys in bucket). In
this case Riak returns a paginated stream, meaning that each item can contain
multiply keys. The high level interface performs a depagination such that each
item contain just a single key.

Because of the wast amount of features in Riak, some high level methods may
not support all the features of the corresponding low level method.

**[Low level interface](#Low-level-interface)**

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

#### client.get(request, callback)

_Directly uses: [RpbGetReq](http://docs.basho.com/riak/latest/dev/references/protocol-buffers/fetch-object/)_

```javascript
client.put({
  bucket: new Buffer('bucket-name'),
  key: new Buffer('key-value'),
  content: { value: new Buffer('content-value') }
}, function (err, response) {
  if (err) throw err;

  console.log(response);
});
```

#### client.put(request, callback)

_Directly uses: [RpbPutReq](http://docs.basho.com/riak/latest/dev/references/protocol-buffers/store-object/)_

```javascript
client.get({
  bucket: new Buffer('riakdb-client-test'),
  key: new Buffer('single key')
}, function (err, response) {
  if (err) throw err;

  console.log(response);
});
```

#### client.del(request, callback)

_Directly uses: [RpbDelReq](http://docs.basho.com/riak/latest/dev/references/protocol-buffers/delete-object/)_

```javascript
client.del({
  bucket: new Buffer('riakdb-client-test'),
  key: new Buffer('single key')
}, function (err, response) {
  if (err) throw err;

  console.log(response);
});
```

### Low level interface

TODO: Document error behaviour and response type patterns

<table>
<thead>
  <tr>
    <th> Name </th>
    <th> Method </th>
    <th> Response Type </th>
    <th> Protocol </th>
  <tr>
</thead>
<tbody>
  <tr>
    <td colspan=3> **Bucket Operations** </td>
  </tr>
  <tr>
    <td colspan=3> **Object/Key Operations** </td>
  </tr>
  <tr>
    <td> Fetch Object </td>
    <td> `client.low.get` </td>
    <td> callback </td>
    <td> [RpbGetReq](http://docs.basho.com/riak/latest/dev/references/protocol-buffers/fetch-object/) </td>
  </tr>
  <tr>
    <td>  Store Object </td>
    <td> `client.low.put` </td>
    <td> callback </td>
    <td> [RpbPutReq](http://docs.basho.com/riak/latest/dev/references/protocol-buffers/store-object/) </td>
  </tr>
  <tr>
    <td> Delete Object </td>
    <td> `client.low.del` </td>
    <td> callback </td>
    <td> [RpbDelReq](http://docs.basho.com/riak/latest/dev/references/protocol-buffers/delete-object/) </td>
  </tr>
  <tr>
    <td colspan=3> **Query Operations** </td>
  </tr>
  <tr>
    <td colspan=3> **Server Operations** </td>
  </tr>
  <tr>
    <td colspan=3> **Bucket Type Operations** </td>
  </tr>
  <tr>
    <td colspan=3> **Data Type Operations** </td>
  </tr>
  <tr>
    <td colspan=3> **Yokozuna Operations** </td>
  </tr>
</tbody>
</table>

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
