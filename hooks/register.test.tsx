import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On, SessionUsage } from 'claude-code'

const MEASURE = {
  context: { window: 200000, tokens: 82000, percent: 41 },
  rateLimits: [
    { kind: 'five_hour', percentUsed: 34, resetsAt: '2030-01-01T02:13:00Z' },
    { kind: 'seven_day', percentUsed: 92.5 },
  ],
  cost: { usd: 1.234 },
}

// 39 columns, after a 25-column mode label
const HINT = '(shift+tab to cycle) · esc to interrupt'

const START = Date.parse('2030-01-01T00:00:00Z')

// Stands for the engine's own drawing: the hint and its tail, an empty band
const drawLikeEngine = (on: On) =>
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text>{e.component === 'PromptHint' ? `${e.props.hint}|${e.props.tail ?? ''}|` : 'engine'}</Text>
  })

const setUp = async ($: Engine, on: On) => {
  mock.clock(on, { now: START })
  mock.store(on)
  on('session.measure', (_, e) => ({ changed: e.changed }))
  drawLikeEngine(on)
  await $.session.measure({ ...MEASURE, changed: ['context', 'rateLimits', 'cost'] })
}

const startSession = async ($: Engine, on: On, usage: Omit<SessionUsage, 'startedAt'>) => {
  const clock = mock.clock(on, { now: START })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.usage', () => ({ value: { startedAt: START, ...usage } }))
  drawLikeEngine(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  return clock
}

const drawHint = async ($: Engine, surface: 'terminal' | 'desktop', columns: number) => {
  const ui = await $.ui.mount({
    plugin: 'usage-band',
    surface,
    component: 'PromptHint',
    props: { isDraft: false, isWorking: true, hint: HINT },
    viewport: { columns, rows: 24 },
  })
  const text = (await ui.find({ type: 'Text' }))?.text
  await ui.unmount()

  return text
}

// 164 - 25 - 39 - 4 = 96 columns of tail
const tail = (text: string, room = 96) => `${HINT}|${' '.repeat(room - text.length)}${text}|`

const SURFACES = ['terminal', 'desktop'] as const

test('hint line by default: right-aligned, high values marked, shorter where room is short', async ($, on) => {
  await setUp($, on)
  for (const surface of SURFACES) {
    expect(await drawHint($, surface, 164)).toBe(tail('5h 34% (2h13m) · 7d 93%! · ctx 41% · $1.23'))
    expect(await drawHint($, surface, 104)).toBe(tail('5h 34% · 7d 93%! · ctx 41% · $1.23', 36))
    expect(await drawHint($, surface, 80)).toBe(tail('5h 34%', 12))
  }
})

test('a short row drops the last figures one by one before the whole usage', async ($, on) => {
  await setUp($, on)
  for (const surface of SURFACES) {
    expect(await drawHint($, surface, 96)).toBe(tail('5h 34% · 7d 93%! · ctx 41%', 28))
    expect(await drawHint($, surface, 86)).toBe(tail('5h 34% · 7d 93%!', 18))
    expect(await drawHint($, surface, 76)).toBe(tail('5h 34%', 8))
    expect(await drawHint($, surface, 75)).toBe(`${HINT}||`)
  }
})

test('a reading without rate limits keeps the last ones', async ($, on) => {
  await setUp($, on)
  await $.session.measure({ ...MEASURE, rateLimits: [], context: { window: 200000, percent: 50 }, changed: ['context'] })
  for (const surface of SURFACES) {
    expect(await drawHint($, surface, 164)).toBe(tail('5h 34% (2h13m) · 7d 93%! · ctx 50% · $1.23'))
  }
})

test('the hint redraws each minute: reset times count down, a passed reset shows 0%', async ($, on) => {
  mock.store(on)
  const clock = await startSession($, on, MEASURE)
  const ui = await $.ui.mount({
    plugin: 'usage-band',
    surface: 'terminal',
    component: 'PromptHint',
    props: { isDraft: false, isWorking: false, hint: HINT },
    viewport: { columns: 164, rows: 24 },
  })
  expect((await ui.find({ type: 'Text' }))?.text).toBe(tail('5h 34% (2h13m) · 7d 93%! · ctx 41% · $1.23'))

  await clock.advance(60 * 60_000)
  expect((await ui.find({ type: 'Text' }))?.text).toBe(tail('5h 34% (1h13m) · 7d 93%! · ctx 41% · $1.23'))

  await clock.advance(80 * 60_000)
  expect((await ui.find({ type: 'Text' }))?.text).toBe(tail('5h 0% · 7d 93%! · ctx 41% · $1.23'))
  await ui.unmount()
})

test('a new session shows the last session\'s rate limits until its first response', async ($, on) => {
  mock.store(on, { limits: MEASURE.rateLimits })
  await startSession($, on, { context: { window: 200000 }, rateLimits: [], cost: { usd: 0 } })
  for (const surface of SURFACES) {
    expect(await drawHint($, surface, 164)).toBe(tail('5h 34% (2h13m) · 7d 93%! · $0.00'))
  }
})

test(
  'settings hide resets, context and cost and turn the mark off',
  { options: { showResets: false, showContext: false, showCost: false, warnAt: 0 } },
  async ($, on) => {
    await setUp($, on)
    for (const surface of SURFACES) {
      expect(await drawHint($, surface, 164)).toBe(tail('5h 34% · 7d 93%'))
    }
  },
)

test('above the prompt: colored percentages, hint line left alone', { options: { position: 'above-prompt' } }, async ($, on) => {
  await setUp($, on)
  for (const surface of SURFACES) {
    expect(await drawHint($, surface, 164)).toBe(`${HINT}||`)

    const ui = await $.ui.mount({
      plugin: 'usage-band',
      surface,
      component: 'AbovePrompt',
      props: {
        hasSurvey: false,
        isWorking: false,
        maxRows: 10,
        bodyColumns: 120,
        scroll: { bodyRows: 10, offset: 0, contentRows: 1 },
        view: {},
      } as never,
    })
    expect(await ui.find({ type: 'Text', text: '5h 34% (2h13m) · 7d 93% · ctx 41% · $1.23' })).toBeDefined()
    expect((await ui.find({ type: 'Text', text: /^93%$/ }))?.props).toMatchObject({ color: 'error' })
    expect((await ui.find({ type: 'Text', text: /^34%$/ }))?.props).toMatchObject({ color: 'success' })
    await ui.unmount()
  }
})
