export type Limit = { kind: string; percentUsed: number; resetsAt?: string }

export type Usage = {
  limits: Limit[]
  contextPercent?: number
  costUsd?: number
}

declare module 'claude-code' {
  interface PluginState {
    'usage-band': { usage: Usage | null }
  }
}
