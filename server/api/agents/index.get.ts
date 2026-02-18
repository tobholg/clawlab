const taskSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    title: { type: 'string' },
    description: { type: ['string', 'null'] },
    status: { type: 'string', enum: ['TODO', 'IN_PROGRESS', 'BLOCKED', 'PAUSED', 'DONE'] },
    subStatus: { type: ['string', 'null'] },
    agentMode: { type: ['string', 'null'], enum: ['PLAN', 'EXECUTE', null] },
    priority: { type: ['string', 'null'], enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL', null] },
    planDocId: { type: ['string', 'null'] },
    acceptedPlanVersion: { type: ['number', 'null'] },
    parentId: { type: ['string', 'null'] },
    projectId: { type: ['string', 'null'] },
    progress: { type: 'number' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
  required: ['id', 'title', 'status', 'progress', 'updatedAt'],
  additionalProperties: false,
} as const

const userSummarySchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    avatar: { type: ['string', 'null'] },
  },
  required: ['id', 'name', 'avatar'],
  additionalProperties: false,
} as const

const agentSessionSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    agentId: { type: 'string' },
    itemId: { type: ['string', 'null'] },
    projectId: { type: ['string', 'null'] },
    terminalId: { type: ['string', 'null'] },
    status: { type: 'string', enum: ['IDLE', 'ACTIVE', 'AWAITING_REVIEW', 'TERMINATED'] },
    checkedOutAt: { type: ['string', 'null'], format: 'date-time' },
    completedAt: { type: ['string', 'null'], format: 'date-time' },
    createdAt: { type: ['string', 'null'], format: 'date-time' },
    updatedAt: { type: ['string', 'null'], format: 'date-time' },
    durationMs: { type: ['number', 'null'] },
    task: {
      type: ['object', 'null'],
      properties: {
        id: { type: 'string' },
        title: { type: 'string' },
        status: { type: 'string' },
        subStatus: { type: ['string', 'null'] },
        progress: { type: 'number' },
        agentMode: { type: ['string', 'null'], enum: ['PLAN', 'EXECUTE', null] },
      },
      required: ['id', 'title', 'status', 'subStatus', 'progress', 'agentMode'],
      additionalProperties: false,
    },
    project: {
      type: ['object', 'null'],
      properties: {
        id: { type: 'string' },
        title: { type: 'string' },
      },
      required: ['id', 'title'],
      additionalProperties: false,
    },
    agent: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
      },
      required: ['id', 'name'],
      additionalProperties: false,
    },
  },
  required: ['id', 'agentId', 'itemId', 'projectId', 'terminalId', 'status', 'checkedOutAt', 'completedAt', 'createdAt', 'updatedAt', 'durationMs', 'task', 'project', 'agent'],
  additionalProperties: false,
} as const

export const AGENT_API_NAME = 'Context Agent API'
export const AGENT_API_VERSION = '1.0'
export const AGENT_API_AUTH = 'Bearer token via Authorization header (prefix: ctx_)'

type AgentApiEndpoint = {
  method: string
  path: string
  description: string
  auth: boolean
  params?: Record<string, any>
  response?: Record<string, any>
}

export function getAgentApiEndpointId(endpoint: Pick<AgentApiEndpoint, 'method' | 'path'>): string {
  const normalizedPath = endpoint.path.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase()
  return `${endpoint.method.toLowerCase()}_${normalizedPath}`
}

export const AGENT_API_ENDPOINTS: AgentApiEndpoint[] = [
      {
        method: 'GET',
        path: '/api/agents/index',
        description: 'Discovery endpoint with lightweight endpoint metadata',
        auth: false,
        params: {
          query: { type: 'object', properties: {}, additionalProperties: false },
        },
        response: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            version: { type: 'string' },
            auth: { type: 'string' },
            endpoints: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  method: { type: 'string' },
                  path: { type: 'string' },
                  description: { type: 'string' },
                  auth: { type: 'boolean' },
                },
                required: ['id', 'method', 'path', 'description', 'auth'],
                additionalProperties: false,
              },
            },
          },
        },
      },
      {
        method: 'GET',
        path: '/api/agents/index/:endpointId',
        description: 'Get full schema details for one endpoint by id',
        auth: false,
        params: {
          path: {
            type: 'object',
            properties: { endpointId: { type: 'string' } },
            required: ['endpointId'],
            additionalProperties: false,
          },
        },
        response: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            method: { type: 'string' },
            path: { type: 'string' },
            description: { type: 'string' },
            auth: { type: 'boolean' },
            params: { type: ['object', 'null'] },
            response: { type: ['object', 'null'] },
          },
          required: ['id', 'method', 'path', 'description', 'auth'],
          additionalProperties: false,
        },
      },
      {
        method: 'GET',
        path: '/api/agents/me',
        description: 'Agent profile and assignment summary',
        auth: true,
        params: {
          query: { type: 'object', properties: {}, additionalProperties: false },
        },
        response: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            agentProvider: { type: ['string', 'null'] },
            projects: { type: 'number' },
            tasks: {
              type: 'object',
              properties: {
                plan: { type: 'number' },
                execute: { type: 'number' },
                review: { type: 'number' },
              },
              required: ['plan', 'execute', 'review'],
              additionalProperties: false,
            },
          },
          required: ['id', 'name', 'agentProvider', 'projects', 'tasks'],
          additionalProperties: false,
        },
      },
      {
        method: 'GET',
        path: '/api/agents/projects',
        description: 'Projects currently assigned to the authenticated agent',
        auth: true,
        params: {
          query: { type: 'object', properties: {}, additionalProperties: false },
        },
        response: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              title: { type: 'string' },
              description: { type: ['string', 'null'] },
              status: { type: 'string' },
              progress: { type: 'number' },
              taskCount: {
                type: 'object',
                properties: {
                  todo: { type: 'number' },
                  inProgress: { type: 'number' },
                  done: { type: 'number' },
                },
                required: ['todo', 'inProgress', 'done'],
                additionalProperties: false,
              },
            },
            required: ['id', 'title', 'description', 'status', 'progress', 'taskCount'],
            additionalProperties: false,
          },
        },
      },
      {
        method: 'GET',
        path: '/api/agents/tasks',
        description: 'List tasks assigned to the authenticated agent with optional filters',
        auth: true,
        params: {
          query: {
            type: 'object',
            properties: {
              projectId: { type: 'string' },
              status: { type: 'string', enum: ['TODO', 'IN_PROGRESS', 'BLOCKED', 'PAUSED', 'DONE'] },
              agentMode: { type: 'string', enum: ['PLAN', 'EXECUTE'] },
              subStatus: { type: 'string' },
            },
            additionalProperties: false,
          },
        },
        response: {
          type: 'array',
          items: taskSchema,
        },
      },
      {
        method: 'POST',
        path: '/api/agents/checkout',
        description: 'Start work on a task by creating or reusing an active agent session',
        auth: true,
        params: {
          body: {
            type: 'object',
            properties: { taskId: { type: 'string' } },
            required: ['taskId'],
            additionalProperties: false,
          },
        },
        response: {
          type: 'object',
          properties: {
            session: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                agentId: { type: 'string' },
                itemId: { type: ['string', 'null'] },
                projectId: { type: ['string', 'null'] },
                terminalId: { type: ['string', 'null'] },
                status: { type: 'string', enum: ['IDLE', 'ACTIVE', 'AWAITING_REVIEW', 'TERMINATED'] },
                checkedOutAt: { type: ['string', 'null'], format: 'date-time' },
                completedAt: { type: ['string', 'null'], format: 'date-time' },
                createdAt: { type: ['string', 'null'], format: 'date-time' },
                updatedAt: { type: ['string', 'null'], format: 'date-time' },
              },
              required: ['id', 'agentId', 'itemId', 'projectId', 'terminalId', 'status', 'checkedOutAt', 'completedAt', 'createdAt', 'updatedAt'],
              additionalProperties: false,
            },
            task: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                title: { type: 'string' },
                description: { type: ['string', 'null'] },
                status: { type: 'string' },
                subStatus: { type: ['string', 'null'] },
                progress: { type: 'number' },
                agentMode: { type: ['string', 'null'], enum: ['PLAN', 'EXECUTE', null] },
                planDoc: {
                  type: ['object', 'null'],
                  properties: {
                    id: { type: 'string' },
                    title: { type: 'string' },
                  },
                  required: ['id', 'title'],
                  additionalProperties: false,
                },
                subtasks: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      title: { type: 'string' },
                      status: { type: 'string' },
                      subStatus: { type: ['string', 'null'] },
                      progress: { type: 'number' },
                    },
                    required: ['id', 'title', 'status', 'subStatus', 'progress'],
                    additionalProperties: false,
                  },
                },
              },
              required: ['id', 'title', 'description', 'status', 'subStatus', 'progress', 'agentMode', 'planDoc', 'subtasks'],
              additionalProperties: false,
            },
          },
          required: ['session', 'task'],
          additionalProperties: false,
        },
      },
      {
        method: 'POST',
        path: '/api/agents/submit',
        description: 'Submit an active session for review and move the task into review sub-status',
        auth: true,
        params: {
          body: {
            type: 'object',
            properties: { taskId: { type: 'string' } },
            required: ['taskId'],
            additionalProperties: false,
          },
        },
        response: {
          type: 'object',
          properties: {
            session: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                agentId: { type: 'string' },
                itemId: { type: ['string', 'null'] },
                projectId: { type: ['string', 'null'] },
                terminalId: { type: ['string', 'null'] },
                status: { type: 'string', enum: ['IDLE', 'ACTIVE', 'AWAITING_REVIEW', 'TERMINATED'] },
                checkedOutAt: { type: ['string', 'null'], format: 'date-time' },
                completedAt: { type: ['string', 'null'], format: 'date-time' },
                createdAt: { type: ['string', 'null'], format: 'date-time' },
                updatedAt: { type: ['string', 'null'], format: 'date-time' },
                durationMs: { type: ['number', 'null'] },
              },
              required: ['id', 'agentId', 'itemId', 'projectId', 'terminalId', 'status', 'checkedOutAt', 'completedAt', 'createdAt', 'updatedAt', 'durationMs'],
              additionalProperties: false,
            },
            task: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                title: { type: 'string' },
                progress: { type: 'number' },
                agentMode: { type: ['string', 'null'], enum: ['PLAN', 'EXECUTE', null] },
                status: { type: 'string' },
                subStatus: { type: ['string', 'null'] },
              },
              required: ['id', 'title', 'progress', 'agentMode', 'status', 'subStatus'],
              additionalProperties: false,
            },
          },
          required: ['session', 'task'],
          additionalProperties: false,
        },
      },
      {
        method: 'GET',
        path: '/api/agents/sessions',
        description: 'List agent sessions; supports filtering by status and fetching only the current active session',
        auth: true,
        params: {
          query: {
            type: 'object',
            properties: {
              status: { type: 'string', enum: ['idle', 'active', 'awaiting_review', 'terminated'] },
              current: { type: 'boolean' },
            },
            additionalProperties: false,
          },
        },
        response: {
          oneOf: [
            { type: 'null' },
            agentSessionSchema,
            {
              type: 'array',
              items: agentSessionSchema,
            },
          ],
        },
      },
      {
        method: 'GET',
        path: '/api/agents/tasks/:id',
        description: 'Full task detail including subtasks, documents, and recent comments',
        auth: true,
        params: {
          path: {
            type: 'object',
            properties: { id: { type: 'string' } },
            required: ['id'],
            additionalProperties: false,
          },
        },
        response: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            description: { type: ['string', 'null'] },
            status: { type: 'string' },
            subStatus: { type: ['string', 'null'] },
            progress: { type: 'number' },
            agentMode: { type: ['string', 'null'] },
            planDocId: { type: ['string', 'null'] },
            acceptedPlanVersion: { type: ['number', 'null'] },
            parent: {
              type: ['object', 'null'],
              properties: { id: { type: 'string' }, title: { type: 'string' } },
            },
            project: {
              type: ['object', 'null'],
              properties: { id: { type: 'string' }, title: { type: 'string' } },
            },
            subtasks: { type: 'array' },
            documents: { type: 'array' },
            comments: { type: 'array' },
          },
          required: ['id', 'title', 'status', 'progress', 'subtasks', 'documents', 'comments'],
        },
      },
      {
        method: 'PATCH',
        path: '/api/agents/tasks/:id',
        description: 'Update task status/subStatus/progress; agent-owned subtasks can also update title, description, category, and priority',
        auth: true,
        params: {
          path: {
            type: 'object',
            properties: { id: { type: 'string' } },
            required: ['id'],
            additionalProperties: false,
          },
          body: {
            type: 'object',
            properties: {
              status: { type: 'string', enum: ['TODO', 'IN_PROGRESS', 'BLOCKED', 'PAUSED'] },
              subStatus: { type: ['string', 'null'] },
              progress: { type: 'number', minimum: 0, maximum: 100 },
              title: { type: 'string' },
              description: { type: ['string', 'null'] },
              category: { type: ['string', 'null'] },
              priority: { type: ['string', 'null'], enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL', null] },
            },
            additionalProperties: false,
          },
        },
        response: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            description: { type: ['string', 'null'] },
            category: { type: ['string', 'null'] },
            priority: { type: ['string', 'null'], enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL', null] },
            status: { type: 'string' },
            subStatus: { type: ['string', 'null'] },
            progress: { type: 'number' },
            agentMode: { type: ['string', 'null'] },
            updatedAt: { type: 'string', format: 'date-time' },
          },
          required: ['id', 'title', 'status', 'subStatus', 'progress', 'agentMode', 'updatedAt'],
          additionalProperties: false,
        },
      },
      {
        method: 'DELETE',
        path: '/api/agents/tasks/:id',
        description: 'Delete an agent-owned subtask',
        auth: true,
        params: {
          path: {
            type: 'object',
            properties: { id: { type: 'string' } },
            required: ['id'],
            additionalProperties: false,
          },
        },
        response: {
          type: 'object',
          properties: { success: { type: 'boolean' } },
          required: ['success'],
          additionalProperties: false,
        },
      },
      {
        method: 'POST',
        path: '/api/agents/tasks/:id/subtasks',
        description: 'Create a subtask owned and assigned to the authenticated agent',
        auth: true,
        params: {
          path: {
            type: 'object',
            properties: { id: { type: 'string' } },
            required: ['id'],
            additionalProperties: false,
          },
          body: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              description: { type: 'string' },
              category: { type: 'string' },
              priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
            },
            required: ['title'],
            additionalProperties: false,
          },
        },
        response: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            description: { type: ['string', 'null'] },
            category: { type: ['string', 'null'] },
            status: { type: 'string' },
            subStatus: { type: ['string', 'null'] },
            priority: { type: 'string' },
            parentId: { type: 'string' },
            projectId: { type: 'string' },
            ownerId: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
          required: ['id', 'title', 'status', 'priority', 'parentId', 'ownerId', 'createdAt', 'updatedAt'],
          additionalProperties: false,
        },
      },
      {
        method: 'GET',
        path: '/api/agents/tasks/:id/comments',
        description: 'List comments for a task with cursor pagination',
        auth: true,
        params: {
          path: {
            type: 'object',
            properties: { id: { type: 'string' } },
            required: ['id'],
            additionalProperties: false,
          },
          query: {
            type: 'object',
            properties: {
              limit: { type: 'number', minimum: 1, maximum: 100 },
              before: { type: 'string' },
            },
            additionalProperties: false,
          },
        },
        response: {
          type: 'object',
          properties: {
            comments: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  content: { type: 'string' },
                  parentCommentId: { type: ['string', 'null'] },
                  createdAt: { type: 'string', format: 'date-time' },
                  updatedAt: { type: 'string', format: 'date-time' },
                  user: userSummarySchema,
                },
                required: ['id', 'content', 'parentCommentId', 'createdAt', 'updatedAt', 'user'],
                additionalProperties: false,
              },
            },
            nextCursor: { type: ['string', 'null'] },
          },
          required: ['comments', 'nextCursor'],
          additionalProperties: false,
        },
      },
      {
        method: 'POST',
        path: '/api/agents/tasks/:id/comments',
        description: 'Create a comment on a task',
        auth: true,
        params: {
          path: {
            type: 'object',
            properties: { id: { type: 'string' } },
            required: ['id'],
            additionalProperties: false,
          },
          body: {
            type: 'object',
            properties: {
              content: { type: 'string', minLength: 1, maxLength: 5000 },
            },
            required: ['content'],
            additionalProperties: false,
          },
        },
        response: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            content: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
            user: userSummarySchema,
          },
          required: ['id', 'content', 'createdAt', 'updatedAt', 'user'],
          additionalProperties: false,
        },
      },
      {
        method: 'GET',
        path: '/api/agents/tasks/:id/docs',
        description: 'List documents attached to a task',
        auth: true,
        params: {
          path: {
            type: 'object',
            properties: { id: { type: 'string' } },
            required: ['id'],
            additionalProperties: false,
          },
        },
        response: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              itemId: { type: 'string' },
              projectId: { type: 'string' },
              title: { type: 'string' },
              content: { type: 'string' },
              isLocked: { type: 'boolean' },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
              createdBy: userSummarySchema,
              lastEditedBy: { type: ['object', 'null'] },
              versionCount: { type: 'number' },
            },
            required: ['id', 'itemId', 'projectId', 'title', 'content', 'isLocked', 'createdAt', 'updatedAt', 'createdBy', 'lastEditedBy', 'versionCount'],
          },
        },
      },
      {
        method: 'POST',
        path: '/api/agents/tasks/:id/docs',
        description: 'Create a document on a task; optionally designate it as the plan document',
        auth: true,
        params: {
          path: {
            type: 'object',
            properties: { id: { type: 'string' } },
            required: ['id'],
            additionalProperties: false,
          },
          body: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              content: { type: 'string' },
              setAsPlan: { type: 'boolean' },
            },
            additionalProperties: false,
          },
        },
        response: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            itemId: { type: 'string' },
            projectId: { type: 'string' },
            title: { type: 'string' },
            content: { type: 'string' },
            isLocked: { type: 'boolean' },
            setAsPlan: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
            createdBy: userSummarySchema,
            lastEditedBy: { type: ['object', 'null'] },
            versionCount: { type: 'number' },
          },
          required: ['id', 'itemId', 'projectId', 'title', 'content', 'isLocked', 'setAsPlan', 'createdAt', 'updatedAt', 'createdBy', 'lastEditedBy', 'versionCount'],
          additionalProperties: false,
        },
      },
      {
        method: 'GET',
        path: '/api/agents/tasks/:id/docs/:docId',
        description: 'Get one task document with full version history',
        auth: true,
        params: {
          path: {
            type: 'object',
            properties: { id: { type: 'string' }, docId: { type: 'string' } },
            required: ['id', 'docId'],
            additionalProperties: false,
          },
        },
        response: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            itemId: { type: 'string' },
            projectId: { type: 'string' },
            title: { type: 'string' },
            content: { type: 'string' },
            isLocked: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
            createdBy: userSummarySchema,
            lastEditedBy: { type: ['object', 'null'] },
            versions: { type: 'array' },
          },
          required: ['id', 'itemId', 'projectId', 'title', 'content', 'isLocked', 'createdAt', 'updatedAt', 'createdBy', 'lastEditedBy', 'versions'],
        },
      },
      {
        method: 'PATCH',
        path: '/api/agents/tasks/:id/docs/:docId',
        description: 'Update a document and create a new document version',
        auth: true,
        params: {
          path: {
            type: 'object',
            properties: { id: { type: 'string' }, docId: { type: 'string' } },
            required: ['id', 'docId'],
            additionalProperties: false,
          },
          body: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              content: { type: 'string' },
              versionLabel: { type: 'string' },
              versionType: { type: 'string', enum: ['MINOR', 'MAJOR'] },
            },
            additionalProperties: false,
          },
        },
        response: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            itemId: { type: 'string' },
            projectId: { type: 'string' },
            title: { type: 'string' },
            content: { type: 'string' },
            isLocked: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
            createdBy: userSummarySchema,
            lastEditedBy: { type: ['object', 'null'] },
            latestVersion: { type: 'object' },
          },
          required: ['id', 'itemId', 'projectId', 'title', 'content', 'isLocked', 'createdAt', 'updatedAt', 'createdBy', 'lastEditedBy', 'latestVersion'],
        },
      },
]

export function getAgentApiEndpointSummaries() {
  return AGENT_API_ENDPOINTS.map((endpoint) => ({
    id: getAgentApiEndpointId(endpoint),
    method: endpoint.method,
    path: endpoint.path,
    description: endpoint.description,
    auth: endpoint.auth,
  }))
}

export function getAgentApiEndpointById(endpointId: string) {
  const endpoint = AGENT_API_ENDPOINTS.find((candidate) => getAgentApiEndpointId(candidate) === endpointId)
  if (!endpoint) {
    return null
  }

  return {
    id: endpointId,
    ...endpoint,
  }
}

export default defineEventHandler(() => ({
  name: AGENT_API_NAME,
  version: AGENT_API_VERSION,
  auth: AGENT_API_AUTH,
  endpoints: getAgentApiEndpointSummaries(),
}))
