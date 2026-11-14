import { config } from '../config.js';
import { AppError } from '../lib/http.js';

export function verifyTrustedOrigin(req, _res, next) {
  const origin = req.get('origin');
  if (origin && !config.frontendOrigins.includes(origin)) {
    next(new AppError(403, 'This origin is not allowed to use the API.', 'ORIGIN_NOT_ALLOWED'));
    return;
  }
  next();
}
