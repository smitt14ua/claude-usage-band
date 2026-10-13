import { expect, mock, test } from 'claude-code/testing'

const MEASURE = {
  context: { window: 200000, tokens: 82000, percent: 41 },
  rateLimits: [
    { kind: 'five_hour', percentUsed: 34, resetsAt: '2030-01-01T02:13:00Z' },
    { kind: 'seven_day', percentUsed: 92.5 },
  ],
  cost: { usd: 1.234 },
  changed: ['context', 'rateLimits', 'cost'] as const,
}

test('the band shows limits, context and cost after a measurement', async ($, on) => {
  mock.clock(on, { now: Date.parse('2030-01-01T00:00:00Z') })
  on('session.measure', (_, e) => ({ changed: e.changed }))
  await $.session.measure({ ...MEASURE, changed: [...MEASURE.changed] })

  for (const surface of ['terminal', 'desktop'] as const) {
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
    await ui.unmount()
  }
})
