import { atom, read, update } from 'claude-code'
import type { PluginOptions, Register, SessionRateLimit } from 'claude-code'

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

type Settings = {
  position: 'hint-line' | 'above-prompt'
  showResets: boolean
  showContext: boolean
  showCost: boolean
  warnAt: number
}

const toSettings = (options: PluginOptions): Settings => ({
  position: options.position === 'above-prompt' ? 'above-prompt' : 'hint-line',
  showResets: options.showResets !== false,
  showContext: options.showContext !== false,
  showCost: options.showCost !== false,
  warnAt: typeof options.warnAt === 'number' ? options.warnAt : 90,
})

type Segment = { name: string; percent?: number; rest: string }

const toSegments = (data: Usage, settings: Settings, now: number, hasResets: boolean): Segment[] => [
  ...data.limits.map(limit => {
    const reset = hasResets && settings.showResets ? untilReset(limit.resetsAt, now) : ''

    return { name: `${label(limit.kind)} `, percent: limit.percentUsed, rest: reset ? ` (${reset})` : '' }
  }),
  ...(settings.showContext && data.contextPercent !== undefined
    ? [{ name: 'ctx ', percent: data.contextPercent, rest: '' }]
    : []),
  ...(settings.showCost && data.costUsd !== undefined
    ? [{ name: `$${data.costUsd.toFixed(2)}`, rest: '' }]
    : []),
]

const isHigh = (percent: number, settings: Settings) => settings.warnAt > 0 && percent >= settings.warnAt

const tone = (percent: number, settings: Settings) =>
  isHigh(percent, settings) ? 'error' : percent >= settings.warnAt - 20 ? 'warning' : 'success'

const percentText = (percent: number, settings: Settings, isMarked: boolean) =>
  `${Math.round(percent)}%${isMarked && isHigh(percent, settings) ? '!' : ''}`

// Plain text for the hint line: no colors there, high values marked with "!"
const toText = (segments: Segment[], settings: Settings) =>
  segments
    .map(s => `${s.name}${s.percent === undefined ? '' : percentText(s.percent, settings, true)}${s.rest}`)
    .join(' · ')

export const register: Register = (on, options) => {
  const settings = toSettings(options)

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
    const data = settings.position === 'hint-line' ? await read($, usage) : null

    if (data === null || e.viewport === undefined) {
      return next(e)
    }

    const now = await $.clock.now()
    const before = (e.props.hint.startsWith(MODE_HINT) ? MODE_LABEL : 0) + e.props.hint.length
    const room = e.viewport.columns - before - MARGIN
    const text = [true, false]
      .map(hasResets => toText(toSegments(data, settings, now, hasResets), settings))
      .find(one => one.length > 0 && one.length + 2 <= room)

    if (text === undefined) {
      return next(e)
    }

    // The tail is plain dim text: no colors on this line
    const tail = ' '.repeat(room - text.length) + text

    return next({ ...e, props: { ...e.props, tail } })
  })

  // Usage in a right-aligned band above the prompt, percentages colored
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const data = settings.position === 'above-prompt' ? await read($, usage) : null
    const now = data === null ? 0 : await $.clock.now()
    const segments = data === null ? [] : toSegments(data, settings, now, e.props.bodyColumns >= 60)

    if (e.props.hasSurvey || segments.length === 0) {
      return next(e)
    }

    const { Box, Text } = $.ui.resolve(e)

    return (
      <Box flexDirection="row" justifyContent="flex-end">
        <Text dimColor>
          {segments.flatMap((s, i) => [
            ...(i === 0 ? [] : [' · ']),
            <Text>
              {s.name}
              {s.percent === undefined ? null : (
                <Text color={tone(s.percent, settings)}>{percentText(s.percent, settings, false)}</Text>
              )}
              {s.rest}
            </Text>,
          ])}
        </Text>
      </Box>
    )
  })
}
