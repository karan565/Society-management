export class AppError extends Error {
  constructor(status, message, code = 'REQUEST_FAILED', details) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const asyncHandler = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

export const validate = (schema, source = 'body') => (req, _res, next) => {
  const parsed = schema.safeParse(req[source]);
  if (!parsed.success) {
    next(
      new AppError(400, 'Request validation failed.', 'VALIDATION_ERROR', {
        issues: parsed.error.issues.map(({ path, message }) => ({ path, message }))
      })
    );
    return;
  }
  req[source] = parsed.data;
  next();
};

export const parseId = (value, label = 'id') => {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuid.test(value || '')) throw new AppError(400, `A valid ${label} is required.`, 'INVALID_ID');
  return value;
};
