const JSONRPC = require('../index')
const expect = require('chai').expect
const ERRORS = require('../src/errors')

describe('JSONRPC', () => {
  it('should not be extensible', () => expect(JSONRPC).to.not.be.extensible)

  describe('#constructor', () => {
    const methods = { foo: function(next) {}}
    const jsonrpc = new JSONRPC(methods)

    it('sets the version', () => expect(jsonrpc.version).to.equal('2.0'))
    it('sets the methods', () => expect(jsonrpc.methods).to.equal(methods))
    it('sets the callbacks', () => expect(jsonrpc.callbacks).to.be.an('object'))
  })

  describe("#notification", () => {
    const jsonrpc = new JSONRPC({})
    const notification = jsonrpc.notification('foo', ['hi'])
    it('has an id', () => expect(notification.id).to.not.exist)
    it('has a jsonrpc version', () => expect(notification.jsonrpc).to.equal(jsonrpc.version))
    it('hasa method', () => expect(notification.method).to.equal('foo'))
    it('has params', () => {
      expect(notification.params).to.have.lengthOf(1)
      expect(notification.params[0]).to.equal('hi')
    })
  })

  describe("#request", () => {
    const jsonrpc = new JSONRPC({})
    const callback = (error, result) => {}
    const request = jsonrpc.request('foo', ['hi'], callback)

    it('has a jsonrpc version', () => expect(request.jsonrpc).to.equal(jsonrpc.version))
    it('has a method', () => expect(request.method).to.equal('foo'))
    it('has a unique id', () => {
      expect(request.id).to.exist
      expect(request.id).to.be.a('string')
      expect(request.id).to.have.lengthOf(36)
    })

    it('has params', () => {
      expect(request.params).to.have.lengthOf(1)
      expect(request.params[0]).to.equal('hi')
    })

    it('stores the callback', () => {
      expect(jsonrpc.callbacks[request.id]).to.exist
      expect(jsonrpc.callbacks[request.id]).to.equal(callback)
    })
  })

  describe("#handleRequest", function() {
    const jsonrpc = new JSONRPC({
      add: function(x, y, next) { next(null, x + y) },
      echoContext: function(next) { next(null ,this) }
    })

    it('responds with JSONRPC response', (done) => {
      const request = new JSONRPC().request('add', [1,2])
      const context = {}
      jsonrpc.handleRequest(request, context, (response) => {
        expect(response.result).to.equal(3)
        expect(response.jsonrpc).to.equal(request.jsonrpc)
        expect(response.id).to.equal(request.id)
        expect(response.error).to.not.exist
        done()
      })
    })

    it('uses given context to call request handler', (done) => {
      const request = new JSONRPC().request('echoContext')
      const context = { test: 'context '}
      jsonrpc.handleRequest(request, context, (response) => {
        expect(response.result).to.equal(context)
        done()
      })
    })

    it('handles unknown requests with a method not found error',  (done) => {
      const request = new JSONRPC().request('doesntExist', ()=> {})
      jsonrpc.handleRequest(request, {}, (response) => {
        expect(response.result).to.not.exist
        expect(response.id).to.equal(request.id)
        expect(response.error).to.equal(ERRORS.METHOD_NOT_FOUND)
        done()
      })
    })
  })

  describe("#handleNotification", function() {

    it('executes the notification handler', (done) => {
      const request = new JSONRPC().notification('foo', ['bar', 'baz'])
      const context = {}
      const jsonrpc = new JSONRPC({
        foo: function(x, y, next) {
          expect(x).to.equal('bar')
          expect(y).to.equal('baz')
          expect(this).to.equal(context)
          expect(next).to.not.exist
          done()
        }
      })

      jsonrpc.handleNotification(request, context)
    })

    it('handles unknown notifications silently', () => {
      const request = new JSONRPC().notification('foo')
      const jsonrpc = new JSONRPC({})
      jsonrpc.handleNotification(request)
    })
  })

  describe("#handleResponse", () => {
    const jsonrpc = new JSONRPC({})

    it('executes the response handler', (done) => {
      const context = { bar: 'baz' }
      let request = jsonrpc.request('foo', [], function(error, result) {
        expect(this).to.equal(context)
        expect(error).to.not.exist
        expect(result).to.equal('foo')
        done()
      })

      jsonrpc.handleResponse({ id: request.id, result: 'foo' }, context)
    })

    it('passes errors to the response handler', (done) => {
      const context = { bar: 'baz' }
      let request = jsonrpc.request('foo', [], function(error, result) {
        expect(this).to.equal(context)
        expect(error).to.equal(ERRORS.METHOD_NOT_FOUND)
        expect(result).to.not.exist
        done()
      })

      jsonrpc.handleResponse({ id: request.id, error: ERRORS.METHOD_NOT_FOUND }, context)
    })

    it('handles unknown responses silently', () => {
      jsonrpc.handleResponse({ id: 'abc123', result: 'foo' }, {})
    })
  })

  describe("#handle", function() {
    it ('handles notificaitons', (done) => {
      const request = new JSONRPC().notification('foo', ['bar', 'baz'])
      const context = {}
      const jsonrpc = new JSONRPC({
        foo: function(x, y, next) {
          expect(x).to.equal('bar')
          expect(y).to.equal('baz')
          expect(this).to.equal(context)
          expect(next).to.not.exist
          done()
        }
      })

      jsonrpc.handle(request, context)
    })

    it ('handles requests', (done) => {
      const request = new JSONRPC().request('add', [1,2])
      const context = {}
      const jsonrpc = new JSONRPC({
        add: function(x, y, next) {
          expect(x).to.equal(1)
          expect(y).to.equal(2)
          expect(this).to.equal(context)
          expect(next).to.be.a("function")
          next(null, x + y)
        },
      })

      jsonrpc.handle(request, context, (response) => {
        expect(response.result).to.equal(3)
        expect(response.jsonrpc).to.equal(request.jsonrpc)
        expect(response.id).to.equal(request.id)
        expect(response.error).to.not.exist
        done()
      })

    })

    it ('handles response', (done) => {
      const jsonrpc = new JSONRPC({})
      const context = { bar: 'baz' }
      let request = jsonrpc.request('foo', [], function(error, result) {
        expect(this).to.equal(context)
        expect(error).to.not.exist
        expect(result).to.equal('foo')
        done()
      })

      jsonrpc.handle({ id: request.id, result: 'foo' }, context)
    })
  })
})