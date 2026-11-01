const HEARTBEAT_INTERVAL_MS = 5000
const STALL_DELAY_MS = 2000
const STALL_REPORT_INTERVAL_MS = 60000
const MAX_COUNTER = 1000

type AppRuntimeState = 'active' | 'inactive' | 'background' | 'unknown'
type DiagnosticReason =
  'startup' | 'route' | 'state' | 'memory_warning' | 'js_stall_recovered'

interface DiagnosticSink {
  setContext: (name: string, context: Record<string, string | number>) => void
  addBreadcrumb: (breadcrumb: {
    category: string
    level: 'info' | 'warning'
    data: Record<string, string | number>
  }) => void
}
interface RuntimeDiagnosticOptions {
  state: string | null
  segments: readonly string[]
  now: () => number
}

// Labels are deliberately independent of collection names, IDs and deep-link data.
function routeLabel(segments: readonly string[]): string {
  if (segments[0] === 'collection') return 'collection'
  if (segments[0] === 'import') return 'import'
  if (segments[0] === '(auth)') return 'auth'
  const route = segments.filter(segment => segment !== '(tabs)').join('/')
  switch (route) {
    case '':
    case 'index':
      return 'collections'
    case 'settings':
    case 'review':
    case 'add-word':
    case 'history':
    case 'audio-review':
    case 'learning-guide':
    case 'dictionary-import':
    case 'dictionary-recovery':
    case 'official-content':
    case 'starter-pack':
    case 'batch-capture':
    case 'insights':
    case 'modal':
      return route
    default:
      return 'unknown'
  }
}

function normalizeState(state: string | null): AppRuntimeState {
  return state === 'active' || state === 'inactive' || state === 'background'
    ? state
    : 'unknown'
}

export { HEARTBEAT_INTERVAL_MS }

/** Best-effort prior-run context; recovered delays do not establish OS kill causes. */
export function createRuntimeDiagnostics(
  sink: DiagnosticSink,
  { state: initialState, segments, now }: RuntimeDiagnosticOptions
) {
  const started = now()
  let state = normalizeState(initialState)
  let route = routeLabel(segments)
  let previousTick = started
  let lastStallReport = -Infinity
  let memoryWarnings = 0
  let stalls = 0
  let maxStallDelay = 0
  let stopped = false

  const publish = (reason: DiagnosticReason) => {
    const context = {
      schema_version: 1,
      route,
      app_state: state,
      observed_at_uptime_ms: Math.max(0, Math.round(now() - started)),
      memory_warning_count: memoryWarnings,
      js_stall_count: stalls,
      max_js_stall_delay_ms: Math.round(maxStallDelay),
      reason,
    }
    // Scope is synchronized to native by the SDK; do not enrich a previous-run
    // watchdog event from the next launch's beforeSend callback.
    try {
      sink.setContext('runtime_diagnostics', context)
      if (reason !== 'startup' && reason !== 'route') {
        sink.addBreadcrumb({
          category: 'app.runtime',
          level: reason === 'state' ? 'info' : 'warning',
          data: context,
        })
      }
    } catch {
      // Diagnostic delivery must never interrupt application or timer handling.
    }
  }
  publish('startup')

  return {
    routeChanged(nextSegments: readonly string[]) {
      const next = routeLabel(nextSegments)
      if (stopped || next === route) return
      route = next
      publish('route')
    },
    stateChanged(nextState: string) {
      const next = normalizeState(nextState)
      if (stopped || next === state) return
      state = next
      previousTick = now()
      publish('state')
    },
    memoryWarning() {
      if (stopped) return
      memoryWarnings = Math.min(MAX_COUNTER, memoryWarnings + 1)
      publish('memory_warning')
    },
    tick() {
      if (stopped) return
      const current = now()
      const delay = current - previousTick - HEARTBEAT_INTERVAL_MS
      previousTick = current
      if (state !== 'active' || delay < STALL_DELAY_MS) return
      stalls = Math.min(MAX_COUNTER, stalls + 1)
      maxStallDelay = Math.max(maxStallDelay, delay)
      if (current - lastStallReport < STALL_REPORT_INTERVAL_MS) return
      lastStallReport = current
      publish('js_stall_recovered')
    },
    stop() {
      stopped = true
    },
  }
}
