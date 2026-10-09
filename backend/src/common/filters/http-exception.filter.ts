import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = '服务器内部错误';
    let code = -1;
    let detail: unknown = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const r = res as Record<string, unknown>;
        message = (r.message as string) || message;
        code = (r.code as number) ?? code;
        detail = r.detail;
      }
    } else if (exception instanceof Error) {
      message = exception.message || message;
    }

    if (status >= 500) {
      this.logger.error(`[${request.method}] ${request.url} -> ${status}`, (exception as Error)?.stack || '');
    } else {
      this.logger.warn(`[${request.method}] ${request.url} -> ${status} ${message}`);
    }

    response.status(status).json({
      success: false,
      code: code === -1 ? status : code,
      message,
      detail,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
