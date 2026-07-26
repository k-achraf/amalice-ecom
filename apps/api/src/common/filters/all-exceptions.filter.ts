import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common'
import type { Request, Response } from 'express'

// Standardizes every error response to the same shape, whether it came from
// an HttpException, a Zod validation failure (nestjs-zod throws a
// BadRequestException subclass, so it's still caught here), or an
// unexpected error the app didn't anticipate.
interface ErrorResponseBody {
  statusCode: number
  error: string
  message: string | string[]
  timestamp: string
  path: string
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name)

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()
    const request = ctx.getRequest<Request>()

    const isHttpException = exception instanceof HttpException
    const status = isHttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR

    let message: string | string[] = 'Internal server error'
    if (isHttpException) {
      const body = exception.getResponse()
      if (typeof body === 'string') {
        message = body
      } else if (typeof body === 'object' && body !== null && 'message' in body) {
        message = (body as { message: string | string[] }).message
      } else {
        message = exception.message
      }
    } else {
      this.logger.error(exception instanceof Error ? exception.stack : exception)
    }

    const errorBody: ErrorResponseBody = {
      statusCode: status,
      error: HttpStatus[status] ?? 'Error',
      message,
      timestamp: new Date().toISOString(),
      path: request.url
    }

    response.status(status).json(errorBody)
  }
}
