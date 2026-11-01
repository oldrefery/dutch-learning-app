import { createRuntimeDiagnostics } from '../runtimeDiagnostics'

describe('runtime diagnostics', () => {
  let now: number
  const sink = { setContext: jest.fn(), addBreadcrumb: jest.fn() }
  const create = (state: string | null = 'active', segments = ['(tabs)']) =>
    createRuntimeDiagnostics(sink, { state, segments, now: () => now })
  const snapshot = () => sink.setContext.mock.calls.at(-1)?.[1]

  beforeEach(() => {
    now = 0
    jest.clearAllMocks()
  })

  it('publishes a bounded initial snapshot before a crash', () => {
    create()
    expect(sink.setContext).toHaveBeenCalledWith('runtime_diagnostics', {
      schema_version: 1,
      route: 'collections',
      app_state: 'active',
      observed_at_uptime_ms: 0,
      memory_warning_count: 0,
      js_stall_count: 0,
      max_js_stall_delay_ms: 0,
      reason: 'startup',
    })
  })
  it('keeps dynamic IDs and unknown screen names out of native scope', () => {
    const diagnostics = create('active', ['collection', 'private-card-id'])
    expect(snapshot().route).toBe('collection')
    diagnostics.routeChanged(['unknown-private-screen', 'secret-token'])
    expect(snapshot().route).toBe('unknown')
    expect(JSON.stringify(sink.setContext.mock.calls)).not.toMatch(
      /private|secret/
    )
  })
  it('does not write for healthy heartbeat ticks', () => {
    const diagnostics = create()
    for (let i = 1; i <= 100; i++) {
      now = i * 5000
      diagnostics.tick()
    }
    expect(sink.setContext).toHaveBeenCalledTimes(1)
    expect(sink.addBreadcrumb).not.toHaveBeenCalled()
  })
  it('records recovered active JS stalls without claiming a watchdog cause', () => {
    const diagnostics = create()
    now = 8000
    diagnostics.tick()
    expect(snapshot()).toEqual(
      expect.objectContaining({
        reason: 'js_stall_recovered',
        js_stall_count: 1,
        max_js_stall_delay_ms: 3000,
        observed_at_uptime_ms: 8000,
      })
    )
    expect(sink.addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'app.runtime',
        level: 'warning',
        data: expect.objectContaining({ reason: 'js_stall_recovered' }),
      })
    )
    expect(JSON.stringify(sink.addBreadcrumb.mock.calls)).not.toContain(
      'Watchdog'
    )
  })
  it('ignores small delays and unchanged routes and states', () => {
    const diagnostics = create()
    now = 6999
    diagnostics.tick()
    diagnostics.routeChanged(['(tabs)'])
    diagnostics.stateChanged('active')
    expect(sink.setContext).toHaveBeenCalledTimes(1)
  })
  it('resets timing across background suspension', () => {
    const diagnostics = create()
    diagnostics.stateChanged('background')
    now = 600000
    diagnostics.tick()
    diagnostics.stateChanged('active')
    now += 5000
    diagnostics.tick()
    expect(snapshot()).toEqual(
      expect.objectContaining({ app_state: 'active', js_stall_count: 0 })
    )
    expect(
      sink.addBreadcrumb.mock.calls.some(
        ([b]) => b.data.reason === 'js_stall_recovered'
      )
    ).toBe(false)
  })
  it('retains memory warning counts across route changes', () => {
    const diagnostics = create()
    diagnostics.memoryWarning()
    diagnostics.memoryWarning()
    diagnostics.routeChanged(['(tabs)', 'settings'])
    expect(snapshot()).toEqual(
      expect.objectContaining({ route: 'settings', memory_warning_count: 2 })
    )
    expect(
      sink.addBreadcrumb.mock.calls.filter(
        ([b]) => b.data.reason === 'memory_warning'
      )
    ).toHaveLength(2)
  })
  it('rate limits stall writes while retaining counts and worst delay', () => {
    const diagnostics = create()
    now = 8000
    diagnostics.tick()
    now = 16000
    diagnostics.tick()
    expect(sink.addBreadcrumb).toHaveBeenCalledTimes(1)
    diagnostics.routeChanged(['(tabs)', 'review'])
    expect(snapshot().js_stall_count).toBe(2)
    now = 80000
    diagnostics.tick()
    expect(snapshot()).toEqual(
      expect.objectContaining({
        js_stall_count: 3,
        max_js_stall_delay_ms: 59000,
      })
    )
  })
  it('never propagates a diagnostic sink failure', () => {
    sink.setContext.mockImplementationOnce(() => {
      throw new Error('Synthetic sink failure')
    })
    expect(() => create()).not.toThrow()
  })
  it('ignores late callbacks after disposal', () => {
    const diagnostics = create()
    diagnostics.stop()
    diagnostics.memoryWarning()
    diagnostics.routeChanged(['(tabs)', 'settings'])
    diagnostics.stateChanged('background')
    now = 9000
    diagnostics.tick()
    expect(sink.setContext).toHaveBeenCalledTimes(1)
    expect(sink.addBreadcrumb).not.toHaveBeenCalled()
  })
})
