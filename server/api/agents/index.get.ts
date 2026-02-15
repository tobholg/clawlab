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

export default defineEventHandler(() => {
  return {
    name: 'Context Agent API',
    version: '1.0',
    auth: 'Bearer token via Authorization header (prefix: ctx_)',
    endpoints: [
      {
        method: 'GET',
        path: '/api/agents/index',
        description: 'Discovery endpoint with JSON schemas for the full agent API surface',
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
            endpoints: { type: 'array' },
          },
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
        description: 'Update allowed task fields (status, subStatus, progress)',
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
            },
            additionalProperties: false,
          },
        },
        response: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            status: { type: 'string' },
            subStatus: { type: ['string', 'null'] },
            progress: { type: 'number' },
            agentMode: { type: ['string', 'null'] },
            updatedAt: { type: 'string', format: 'date-time' },
          },
          required: ['id', 'status', 'subStatus', 'progress', 'agentMode', 'updatedAt'],
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
    ],
  }
})
