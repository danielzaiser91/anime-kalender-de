export type Phase = 'plan' | 'design' | 'delegate' | 'review' | 'close'

export type PlannedTask = {
  title: string
  tier: string
  after: number[]
}

export type Flow = {
  title: string
  total: number
  done: number
  running: number
  phase: Phase
  isFinished: boolean
  tasks: PlannedTask[]
}

/** One planned step of a worker; the percents of a plan add up to 100. */
export type Schritt = { name: string; percent: number }

export type AgentStatus = 'running' | 'done' | 'failed'

export type AgentRun = {
  id: string
  agentId?: string
  type: string
  description: string
  model: string
  effort?: string
  status: AgentStatus
  startedAt: number
  endedAt?: number
  contextTokens: number
  contextMax: number
  steps: number
  round: number
  /** Self-reported by the worker through the `step` tool: cumulative progress 0-100 and its plan. */
  stepPercent?: number
  stepPlan?: Schritt[]
  stepNote?: string
  /** Self-reported by the worker through the `step` tool: best estimate of its total duration from its start, in minutes. */
  estimateMin?: number
}

export type Panel = {
  isCompact: boolean
  isReviewerCollapsed: boolean
  autoOpenedFor: string
}

declare module 'claude-code' {
  interface PluginState {
    'savvy-progress': {
      flow: Flow | null
      agents: AgentRun[]
      panel: Panel
      now: number
    }
  }
}
