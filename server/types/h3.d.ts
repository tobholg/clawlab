import type { AgentContextUser } from '../utils/agentApi'

declare module 'h3' {
  interface H3EventContext {
    agentUser?: AgentContextUser
  }
}

export {}
