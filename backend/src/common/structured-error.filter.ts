import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';

function shouldUseJsonLogs() {
  return process.env.LOG_FORMAT?.toLowerCase() === 'json';
}

function sanitizePath(rawUrl: string) {
  try {
    const parsed = new URL(rawUrl, 'http://moodlelike.local');
    for (const [key] of parsed.searchParams) {
      if (/token|password|secret|signature|authorization/i.test(key)) {
        parsed.searchParams.set(key, '[redacted]');
      }
    }
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return rawUrl.replace(/([?&][^=]*(?:token|password|secret|signature|authorization)[^=]*=)[^&]*/gi, '$1[redacted]');
  }
}

function getMessage(responseBody: string | object) {
  if (typeof responseBody === 'string') return responseBody;
  const message = (responseBody as { message?: unknown }).message;
  if (Array.isArray(message)) return message.join('；');
  if (typeof message === 'string') return message;
  return '请求处理失败。';
}

function getErrorCode(status: number, responseBody: string | object) {
  if (typeof responseBody === 'object') {
    const code = (responseBody as { code?: unknown }).code;
    if (typeof code === 'string' && code.trim()) return code.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_');
    const error = (responseBody as { error?: unknown }).error;
    if (typeof error === 'string') return error.toUpperCase().replace(/[^A-Z0-9]+/g, '_');
  }
  return `HTTP_${status}`;
}

function statusFromUnknownHttpError(exception: unknown) {
  if (exception instanceof HttpException) return exception.getStatus();
  if (!exception || typeof exception !== 'object') return HttpStatus.INTERNAL_SERVER_ERROR;
  const record = exception as { status?: unknown; statusCode?: unknown };
  const status = Number(record.status ?? record.statusCode);
  return Number.isInteger(status) && status >= 400 && status < 600 ? status : HttpStatus.INTERNAL_SERVER_ERROR;
}

function bodyFromUnknownHttpError(exception: unknown, status: number): string | object {
  if (exception instanceof HttpException) return exception.getResponse();
  if (exception instanceof Error && status < 500) return exception.message;
  return '服务器暂时无法处理请求。';
}

function exceptionType(exception: unknown) {
  if (!exception || typeof exception !== 'object') return undefined;
  const type = (exception as { type?: unknown }).type;
  return typeof type === 'string' ? type : undefined;
}

@Catch()
export class StructuredErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(StructuredErrorFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const request = context.getRequest<any>();
    const response = context.getResponse<any>();
    const status = statusFromUnknownHttpError(exception);
    const exceptionBody = bodyFromUnknownHttpError(exception, status);
    const message = getMessage(exceptionBody);
    const errorCode = getErrorCode(status, exceptionBody);
    const durationMs = typeof request.startedAt === 'number' ? Date.now() - request.startedAt : undefined;
    const entry = {
      level: status >= 500 ? 'error' : 'warn',
      event: 'http_error',
      method: request.method,
      path: sanitizePath(request.originalUrl || request.url || ''),
      status,
      durationMs,
      errorCode,
      exceptionType: exceptionType(exception),
      requestId: request.requestId,
      timestamp: new Date().toISOString()
    };

    if (shouldUseJsonLogs()) {
      console[status >= 500 ? 'error' : 'warn'](JSON.stringify(entry));
    } else {
      this.logger[status >= 500 ? 'error' : 'warn'](
        `${entry.method} ${entry.path} ${entry.status} ${entry.errorCode} requestId=${entry.requestId}`
      );
    }

    response.status(status).json({
      statusCode: status,
      message,
      errorCode,
      requestId: request.requestId,
      timestamp: entry.timestamp
    });
  }
}
