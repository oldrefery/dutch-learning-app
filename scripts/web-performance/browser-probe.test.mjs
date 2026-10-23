import assert from 'node:assert/strict'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import { installBrowserProbe } from './browser-probe.mjs'

test('pending hydration gets one initial click; each subsequent real UI transition is awaited', () => {
  const radio = text => ({
    textContent: text,
    disabled: false,
    clicks: 0,
    checked: false,
    getClientRects: () => [{}],
    getAttribute() {
      return String(this.checked)
    },
    click() {
      this.clicks++
    },
  })
  const recognition = radio('Recognition'),
    adaptive = radio('Adaptive'),
    collection = radio('One collection'),
    allDue = radio('All due')
  const start = radio('Start · 20Enter')
  const radios = [recognition, adaptive, collection, allDue]
  let nextFrame,
    now = 0
  const window = {}
  const document = {
    addEventListener() {},
    querySelectorAll: selector =>
      selector === '[role="radio"]'
        ? radios
        : selector === 'button'
          ? [...radios, start]
          : [],
  }
  runInNewContext(`(${installBrowserProbe.toString()})({ selected: 20 })`, {
    window,
    location: { pathname: '/app/review' },
    performance: { now: () => now },
    requestAnimationFrame: callback => {
      nextFrame = callback
    },
    PerformanceObserver: class {
      observe() {}
    },
    document,
  })
  const tick = (count = 1) => {
    for (let i = 0; i < count; i++) {
      now += 16
      nextFrame()
    }
  }
  recognition.disabled = true
  recognition.checked = true
  tick(100)
  assert.equal(
    recognition.clicks,
    0,
    'Unready SSR controls cannot handle a click'
  )
  assert.equal(
    adaptive.clicks,
    0,
    'SSR checked markup is not a completed interaction'
  )
  recognition.checked = false
  recognition.disabled = false
  tick(100)
  assert.equal(recognition.clicks, 1, 'No repeated pre-hydration clicks')
  assert.equal(adaptive.clicks, 0)
  recognition.checked = true
  tick(100)
  assert.equal(adaptive.clicks, 1)
  adaptive.checked = true
  tick(100)
  assert.equal(collection.clicks, 1)
  collection.checked = true
  tick(100)
  assert.equal(allDue.clicks, 1)
  allDue.checked = true
  tick(100)
  assert.equal(start.clicks, 1)
  assert.equal(window.__reviewPerformance.stage, 4)
  assert.ok(window.__reviewPerformance.setupMs > 0)
})
