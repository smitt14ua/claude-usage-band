import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

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
const FULL = '5h 34% (2h13m) · 7d 93% · ctx 41% · $1.23'
const SHORT = '5h 34% · 7d 93% · ctx 41% · $1.23'

test('usage rides the hint line, right-aligned, shorter where room is short', async ($, on) => {
  mock.clock(on, { now: Date.parse('2030-01-01T00:00:00Z') })
  on('session.measure', (_, e) => ({ changed: e.changed }))
  // Stands for the engine's hint line: the hint, then its tail
  on('ui.render', { component: 'PromptHint' }, ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text>{`${e.props.hint}|${e.props.tail ?? ''}|`}</Text>
  })
  await $.session.measure({ ...MEASURE, changed: ['context', 'rateLimits', 'cost'] })

  const draw = async ($: Engine, surface: 'terminal' | 'desktop', columns: number) => {
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

  for (const surface of ['terminal', 'desktop'] as const) {
    // 164 - 25 - 39 - 4 = 96 columns of tail
    expect(await draw($, surface, 164)).toBe(`${HINT}|${' '.repeat(96 - FULL.length)}${FULL}|`)
    expect(await draw($, surface, 104)).toBe(`${HINT}|${' '.repeat(36 - SHORT.length)}${SHORT}|`)
    expect(await draw($, surface, 80)).toBe(`${HINT}||`)
  }
})
