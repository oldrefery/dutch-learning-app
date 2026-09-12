// Installed only into a fresh, test-owned browser context. No production hooks.
export function installBrowserProbe({ selected }) {
  const probe = {
    startedMs: null,
    feedbackMs: null,
    setupMs: null,
    startMs: null,
    cardMs: null,
    longTasks: [],
    stage: 0,
    done: false,
  }
  window.__reviewPerformance = probe
  const observer = new PerformanceObserver(list => {
    for (const entry of list.getEntries()) {
      probe.longTasks.push({
        startTime: entry.startTime,
        duration: entry.duration,
      })
    }
  })
  observer.observe({ type: 'longtask', buffered: true })

  const begin = startedMs => {
    probe.startedMs = startedMs
    probe.feedbackMs = null
    probe.setupMs = null
    probe.startMs = null
    probe.cardMs = null
    probe.stage = 0
    probe.done = false
  }
  document.addEventListener(
    'click',
    event => {
      const anchor = event.target.closest?.('a')
      if (anchor && new URL(anchor.href).pathname === '/app/review')
        begin(performance.now())
    },
    true
  )
  if (location.pathname === '/app/review') begin(0)

  const visible = element => element && element.getClientRects().length > 0
  const enabled = element => visible(element) && !element.disabled
  const checked = element => element?.getAttribute('aria-checked') === 'true'
  const findRadio = prefix =>
    [...document.querySelectorAll('[role="radio"]')].find(element =>
      element.textContent.trim().startsWith(prefix)
    )

  const recordCard = () => {
    const article = [...document.querySelectorAll('article')].find(element =>
      element.querySelector('h1')
    )
    const action =
      article &&
      [...article.querySelectorAll('button')].find(
        button =>
          !button.textContent.includes('Play pronunciation') && enabled(button)
      )
    if (action) {
      probe.cardMs = performance.now()
      probe.done = true
    }
  }

  const advanceSetup = start => {
    const recognition = findRadio('Recognition')
    const adaptive = findRadio('Adaptive')
    const collection = findRadio('One collection')
    const allDue = findRadio('All due')
    // Initially checked SSR markup is not proof of hydration. Require actual
    // mode AND scope changes to be accepted by the real React handlers.
    if (probe.stage === 0 && enabled(recognition)) recognition.click()
    const transitions = [
      [checked(recognition), () => adaptive.click()],
      [checked(adaptive), () => collection.click()],
      [checked(collection), () => allDue.click()],
      [
        checked(allDue) && enabled(start),
        () => {
          probe.setupMs = performance.now()
          probe.startMs = performance.now()
          start.click()
        },
      ],
    ]
    const transition = transitions[probe.stage]
    if (transition?.[0]) {
      probe.stage++
      transition[1]()
    }
  }

  const tick = () => {
    if (probe.startedMs !== null && !probe.done) {
      const now = performance.now()
      const start = [...document.querySelectorAll('button')].find(button =>
        button.textContent.startsWith(`Start · ${selected}Enter`)
      )
      const loading = [...document.querySelectorAll('p')].some(
        element =>
          visible(element) &&
          element.textContent.includes('Loading review workspace')
      )
      if (probe.feedbackMs === null && (loading || visible(start)))
        probe.feedbackMs = now

      if (probe.stage === 4) recordCard()
      else advanceSetup(start)
    }
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

export function readBrowserMetrics() {
  const probe = window.__reviewPerformance
  const entries = [
    ...performance.getEntriesByType('navigation'),
    ...performance.getEntriesByType('resource'),
  ].filter(
    entry =>
      entry.startTime >= probe.startedMs && entry.startTime <= probe.cardMs
  )
  return {
    feedbackMs: probe.feedbackMs - probe.startedMs,
    setupMs: probe.setupMs - probe.startedMs,
    startToCardMs: probe.cardMs - probe.startMs,
    navigationToCardMs: probe.cardMs - probe.startedMs,
    interactionProbeMs:
      'Includes mode/scope verification over animation frames',
    longTasks: probe.longTasks.filter(
      entry =>
        entry.startTime >= probe.startedMs && entry.startTime <= probe.cardMs
    ),
    resources: entries.map(entry => ({
      // Do not retain query parameters, HTML, headers, cookies or response data.
      path: new URL(entry.name).pathname,
      type: entry.initiatorType ?? entry.entryType,
      startedMs: entry.startTime - probe.startedMs,
      responseStartMs: entry.responseStart - probe.startedMs,
      responseEndMs: entry.responseEnd - probe.startedMs,
      transferBytes: entry.transferSize,
      encodedBytes: entry.encodedBodySize,
      decodedBytes: entry.decodedBodySize,
    })),
  }
}
