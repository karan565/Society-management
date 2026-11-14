import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';

import { config } from './config.js';
import { prisma } from './db.js';
import { errorHandler, notFoundHandler } from './middleware/errors.js';
import authRoutes from './routes/auth/index.js';
import complaintsRoutes from './routes/complaints/index.js';
import financesRoutes from './routes/finances/index.js';
import maintenanceRoutes from './routes/maintenance/index.js';
import societiesRoutes from './routes/societies/index.js';
import usersRoutes from './routes/users/index.js';
import { AppError, asyncHandler } from './lib/http.js';

export const app = express();
app.set('trust proxy', config.trustProxy);
app.disable('x-powered-by');
app.use(helmet());
app.use(
  cors({
    credentials: true,
    origin(origin, callback) {
      if (!origin || config.frontendOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new AppError(403, 'This origin is not allowed to use the API.', 'ORIGIN_NOT_ALLOWED'));
    }
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

app.get(
  '/api/health',
  asyncHandler(async (_req, res) => {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', database: 'connected' });
  })
);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many authentication attempts. Try again later.' } }
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/refresh', authLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/societies', societiesRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/finances', financesRoutes);
app.use('/api/complaints', complaintsRoutes);
app.use(notFoundHandler);
app.use(errorHandler);
