import { atom, read, update } from 'claude-code'
import type { Register, SessionRateLimit } from 'claude-code'

import type { Usage } from '../types'

const usage = atom({ plugin: 'usage-band', key: 'usage' } as const, null)

const LABELS: Record<string, string> = {
  five_hour: '5h',
  seven_day: '7d',
  seven_day_opus: '7d opus',
  seven_day_sonnet: '7d sonnet',
  spend_limit: 'spend',
}

const label = (kind: string) => LABELS[kind] ?? kind.replace(/_/g, ' ')

const untilReset = (resetsAt: string | undefined, now: number) => {
  if (!resetsAt) {
    return ''
  }
  const minutes = Math.round((Date.parse(resetsAt) - now) / 60000)
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return ''
  }
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  const mins = minutes % 60

  return days > 0 ? `${days}d${hours}h` : hours > 0 ? `${hours}h${mins}m` : `${mins}m`
}

// The mode label drawn before the hint when it starts so ("⏵⏵ bypass permissions on", the widest)
const MODE_HINT = '(shift+tab to cycle)'
const MODE_LABEL = 25
// Prompt box padding and a gap before the usage
const MARGIN = 4

const toUsage = (e: { rateLimits: SessionRateLimit[]; context: { percent?: number }; cost?: { usd: number } }): Usage => ({
  limits: e.rateLimits,
  contextPercent: e.context.percent,
  costUsd: e.cost?.usd,
})

const format = (data: Usage, now: number, hasResets: boolean) =>
  [
    ...data.limits.map(limit => {
      const reset = hasResets ? untilReset(limit.resetsAt, now) : ''

      return `${label(limit.kind)} ${Math.round(limit.percentUsed)}%${reset ? ` (${reset})` : ''}`
    }),
    ...(data.contextPercent === undefined ? [] : [`ctx ${data.contextPercent}%`]),
    ...(data.costUsd === undefined ? [] : [`$${data.costUsd.toFixed(2)}`]),
  ].join(' · ')

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    const now = toUsage(await $.session.usage())
    await update($, usage, () => now)

    return result
  })

  on('session.measure', async ($, e, next) => {
    await update($, usage, () => toUsage(e))

    return next(e)
  })

  // Usage at the right end of the hint line under the prompt
  on('ui.render', { component: 'PromptHint' }, async ($, e, next) => {
    const data = await read($, usage)

    if (data === null || e.viewport === undefined) {
      return next(e)
    }

    const now = await $.clock.now()
    const before = (e.props.hint.startsWith(MODE_HINT) ? MODE_LABEL : 0) + e.props.hint.length
    const room = e.viewport.columns - before - MARGIN
    const text = [format(data, now, true), format(data, now, false)].find(
      one => one.length > 0 && one.length + 2 <= room,
    )

    if (text === undefined) {
      return next(e)
    }

    // The tail is plain dim text: no colors on this line
    const tail = ' '.repeat(room - text.length) + text

    return next({ ...e, props: { ...e.props, tail } })
  })
}
