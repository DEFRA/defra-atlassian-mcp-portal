import { STATUS_CODES } from 'node:http'
import { constants as statusCodes } from 'node:http2'

import { vi } from 'vitest'

import { catchAll } from '../../../src/server/catch-all.js'

const mockErrorLogger = vi.fn()
const mockStack = 'Mock error stack'
const errorPage = 'common/error'
const mockRequest = (statusCode, customMessage) => ({
  response: {
    isBoom: true,
    stack: mockStack,
    output: {
      payload: {
        statusCode,
        error: STATUS_CODES[statusCode],
        message: customMessage ?? STATUS_CODES[statusCode]
      }
    }
  },
  logger: { error: mockErrorLogger }
})
function toolkit () {
  return {
    view: vi.fn().mockReturnThis(),
    code: vi.fn().mockReturnThis()
  }
}

describe('catchAll', () => {
  test('renders the Not Found page for 404', () => {
    const h = toolkit()

    catchAll(mockRequest(statusCodes.HTTP_STATUS_NOT_FOUND), h)

    expect(mockErrorLogger).not.toHaveBeenCalled()
    expect(h.view).toHaveBeenCalledWith(errorPage, {
      pageTitle: 'Page not found',
      heading: statusCodes.HTTP_STATUS_NOT_FOUND,
      message: 'Page not found'
    })
    expect(h.code).toHaveBeenCalledWith(statusCodes.HTTP_STATUS_NOT_FOUND)
  })

  test('renders the Forbidden page for 403', () => {
    const h = toolkit()

    catchAll(mockRequest(statusCodes.HTTP_STATUS_FORBIDDEN), h)

    expect(mockErrorLogger).not.toHaveBeenCalled()
    expect(h.view).toHaveBeenCalledWith(errorPage, {
      pageTitle: 'Forbidden',
      heading: statusCodes.HTTP_STATUS_FORBIDDEN,
      message: 'Forbidden'
    })
    expect(h.code).toHaveBeenCalledWith(statusCodes.HTTP_STATUS_FORBIDDEN)
  })

  test('renders the Unauthorized page for 401', () => {
    const h = toolkit()

    catchAll(mockRequest(statusCodes.HTTP_STATUS_UNAUTHORIZED), h)

    expect(mockErrorLogger).not.toHaveBeenCalled()
    expect(h.view).toHaveBeenCalledWith(errorPage, {
      pageTitle: 'Unauthorized',
      heading: statusCodes.HTTP_STATUS_UNAUTHORIZED,
      message: 'Unauthorized'
    })
    expect(h.code).toHaveBeenCalledWith(statusCodes.HTTP_STATUS_UNAUTHORIZED)
  })

  test('renders the Bad Request page for 400', () => {
    const h = toolkit()

    catchAll(mockRequest(statusCodes.HTTP_STATUS_BAD_REQUEST), h)

    expect(mockErrorLogger).not.toHaveBeenCalled()
    expect(h.view).toHaveBeenCalledWith(errorPage, {
      pageTitle: 'Bad Request',
      heading: statusCodes.HTTP_STATUS_BAD_REQUEST,
      message: 'Bad Request'
    })
    expect(h.code).toHaveBeenCalledWith(statusCodes.HTTP_STATUS_BAD_REQUEST)
  })

  test('renders a default error page for unrecognized status codes', () => {
    const h = toolkit()

    catchAll(mockRequest(statusCodes.HTTP_STATUS_TEAPOT), h)

    expect(mockErrorLogger).not.toHaveBeenCalled()
    expect(h.view).toHaveBeenCalledWith(errorPage, {
      pageTitle: 'Something went wrong',
      heading: statusCodes.HTTP_STATUS_TEAPOT,
      message: 'Something went wrong'
    })
    expect(h.code).toHaveBeenCalledWith(statusCodes.HTTP_STATUS_TEAPOT)
  })

  test('uses a custom Boom message when explicitly overridden', () => {
    const h = toolkit()

    catchAll(mockRequest(statusCodes.HTTP_STATUS_NOT_FOUND, 'No analysis found for this document'), h)

    expect(mockErrorLogger).not.toHaveBeenCalled()
    expect(h.view).toHaveBeenCalledWith(errorPage, {
      pageTitle: 'No analysis found for this document',
      heading: statusCodes.HTTP_STATUS_NOT_FOUND,
      message: 'No analysis found for this document'
    })
    expect(h.code).toHaveBeenCalledWith(statusCodes.HTTP_STATUS_NOT_FOUND)
  })

  test('renders error page and logs internal server errors', () => {
    const h = toolkit()

    catchAll(mockRequest(statusCodes.HTTP_STATUS_INTERNAL_SERVER_ERROR), h)

    expect(mockErrorLogger).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ stack_trace: mockStack })
      }),
      'Internal server error'
    )
    expect(h.view).toHaveBeenCalledWith(errorPage, {
      pageTitle: 'Something went wrong',
      heading: statusCodes.HTTP_STATUS_INTERNAL_SERVER_ERROR,
      message: 'Something went wrong'
    })
    expect(h.code).toHaveBeenCalledWith(
      statusCodes.HTTP_STATUS_INTERNAL_SERVER_ERROR
    )
  })

  test('passes a non-Boom response straight through without rendering an error page', () => {
    const passThroughSentinel = Symbol('continue')
    const nonBoomToolkit = { continue: passThroughSentinel, view: vi.fn(), code: vi.fn() }
    const request = { response: { statusCode: 200 }, logger: { error: vi.fn() } }

    const result = catchAll(request, nonBoomToolkit)

    expect(result).toBe(passThroughSentinel)
    expect(nonBoomToolkit.view).not.toHaveBeenCalled()
  })
})
