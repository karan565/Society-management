import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';

import { config } from '../config.js';
import { AppError } from '../lib/http.js';

export function notFoundHandler(_req, _res, next) {
  next(new AppError(404, 'The requested API route was not found.', 'NOT_FOUND'));
}

export function errorHandler(error, _req, res, _next) {
  let status = error instanceof AppError ? error.status : 500;
  let code = error instanceof AppError ? error.code : 'INTERNAL_ERROR';
  let message = error instanceof AppError ? error.message : 'An unexpected server error occurred.';

  if (error instanceof ZodError) {
    status = 400;
    code = 'VALIDATION_ERROR';
    message = 'Request validation failed.';
  } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2034') {
      status = 409;
      code = 'CONCURRENT_UPDATE';
      message = 'Another request changed this record at the same time. Retry the operation.';
    } else if (error.code === 'P2002') {
      status = 409;
      code = 'CONFLICT';
      message = 'A record with the same unique value already exists.';
    } else if (error.code === 'P2025') {
      status = 404;
      code = 'NOT_FOUND';
      message = 'The requested record could not be found.';
    } else if (error.code === 'P2003') {
      status = 409;
      code = 'RELATED_RECORD';
      message = 'This record cannot be changed while related records exist.';
    }
  }

  if (status >= 500) console.error(error);
  res.status(status).json({
    error: {
      code,
      message,
      ...(error.details ? { details: error.details } : {}),
      ...(config.nodeEnv !== 'production' && status >= 500 ? { detail: error.message } : {})
    }
  });
}
