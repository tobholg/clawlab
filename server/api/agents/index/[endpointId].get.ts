import { getAgentApiEndpointById } from '../index.get'

export default defineEventHandler((event) => {
  const endpointId = getRouterParam(event, 'endpointId')
  if (!endpointId) {
    throw createError({ statusCode: 400, message: 'Endpoint ID is required' })
  }

  const endpoint = getAgentApiEndpointById(endpointId)
  if (!endpoint) {
    throw createError({ statusCode: 404, message: 'Endpoint not found' })
  }

  return endpoint
})
