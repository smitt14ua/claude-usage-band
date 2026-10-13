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

const tone = (percent: number) =>
  percent >= 90 ? 'error' : percent >= 70 ? 'warning' : 'success'

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

const toUsage = (e: { rateLimits: SessionRateLimit[]; context: { percent?: number }; cost?: { usd: number } }): Usage => ({
  limits: e.rateLimits,
  contextPercent: e.context.percent,
  costUsd: e.cost?.usd,
})

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

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const data = await read($, usage)
    const isEmpty =
      data === null ||
      (data.limits.length === 0 && data.contextPercent === undefined && data.costUsd === undefined)

    if (e.props.hasSurvey || isEmpty) {
      return next(e)
    }

    const { Box, Text } = $.ui.resolve(e)
    const now = await $.clock.now()
    // Reset times only where the line has room for them
    const hasResets = e.props.bodyColumns >= 60

    const parts = [
      ...data.limits.map(limit => {
        const reset = hasResets ? untilReset(limit.resetsAt, now) : ''

        return (
          <Text>
            {label(limit.kind)}{' '}
            <Text color={tone(limit.percentUsed)}>{Math.round(limit.percentUsed)}%</Text>
            {reset ? ` (${reset})` : ''}
          </Text>
        )
      }),
      ...(data.contextPercent === undefined
        ? []
        : [
            <Text>
              ctx <Text color={tone(data.contextPercent)}>{data.contextPercent}%</Text>
            </Text>,
          ]),
      ...(data.costUsd === undefined ? [] : [<Text>${data.costUsd.toFixed(2)}</Text>]),
    ]

    return (
      <Box flexDirection="row" justifyContent="flex-end">
        <Text dimColor>
          {parts.flatMap((part, i) => (i === 0 ? [part] : [' · ', part]))}
        </Text>
      </Box>
    )
  })
}
