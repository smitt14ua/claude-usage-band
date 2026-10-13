import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

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

const setUp = async ($: Engine, on: On) => {
  mock.clock(on, { now: Date.parse('2030-01-01T00:00:00Z') })
  on('session.measure', (_, e) => ({ changed: e.changed }))
  // Stands for the engine's own drawing: the hint and its tail, an empty band
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text>{e.component === 'PromptHint' ? `${e.props.hint}|${e.props.tail ?? ''}|` : 'engine'}</Text>
  })
  await $.session.measure({ ...MEASURE, changed: ['context', 'rateLimits', 'cost'] })
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
    expect(await drawHint($, surface, 80)).toBe(`${HINT}||`)
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
