// This is a very simple test framework that leverages the tap framework
// to run tests and output tap-parseable results.

module.exports = Test

var assert = require("./assert")
  , inherits = require("./inherits")
  , Results = require("./results")

// tests are also test harnesses
inherits(Test, require("./harness"))

function Test (harness, name, conf) {
  if (!(this instanceof Test)) return new Test(harness, name, conf)

  Test.super.call(this)

  conf.name = name || conf.name || "(anonymous)"
  this.conf = conf

  this.harness = harness
  this.harness.add(this)
}

Test.prototype.clear = function () {
  this._started = false
  this._ended = false
  this._plan = null
  this._bailedOut = false
  this.results = new Results()
}

// this gets called if a test throws ever
Test.prototype.threw = function (ex) {
  //console.error("threw!", ex.stack)
  this.fail(ex.name + ": " + ex.message, { error: ex, thrown: true })
  // may emit further failing tests if the plan is not completed
  //console.error("end, because it threw")
  this.end()
}

Test.prototype.result = function (res) {
  this.results.add(res)
  this.emit("result", res)
}

// parasitic
// Who says you can't do multiple inheritance in js?
Object.getOwnPropertyNames(assert).forEach(function (k) {
  if (k === "prototype" || k === "name") return
  var d = Object.getOwnPropertyDescriptor(assert, k)
    , v = d.value
  if (!v) return
  d.value = assertParasite(v)
  Object.defineProperty(Test.prototype, k, d)
})

function assertParasite (fn) { return function _testAssert () {
  //console.error("_testAssert", fn.name, arguments)
  if (this._bailedOut) return
  var res = fn.apply(assert, arguments)
  this.result(res)
}}

// a few tweaks on the EE emit function, because
// we want to catch all thrown errors and bubble up "bailout"
Test.prototype.emit = (function (em) { return function (t) {
  // bailouts bubble until handled
  if (t === "bailout" &&
      this.listeners(t).length === 0 &&
      this.harness) {
    return this.harness.bailout(arguments[1])
  }

  if (t === "error") return em.apply(this, arguments)
  try {
    em.apply(this, arguments)
  } catch (ex) {
    // any exceptions in a test are a failure
    //console.error("caught!", ex.stack)
    this.threw(ex)
  }
}})(Test.super.prototype.emit)