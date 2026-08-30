import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import type { Request, Response } from 'express';
import { MetricsService } from './metrics.service.js';

@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const stop = this.metrics.httpDuration.startTimer();

    const record = () => {
      // Route pattern, not the raw URL — raw ids would explode label cardinality.
      const route = (request.route?.path as string | undefined) ?? 'unmatched';
      const labels = {
        method: request.method,
        route,
        status: String(response.statusCode),
      };
      stop(labels);
      this.metrics.httpRequests.inc(labels);
    };

    return next.handle().pipe(tap({ next: record, error: record }));
  }
}
