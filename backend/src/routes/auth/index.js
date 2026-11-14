import { Router } from 'express';
import { z } from 'zod';

import { requireAuth } from '../../middleware/auth.js';
import { verifyTrustedOrigin } from '../../middleware/csrf.js';
import { asyncHandler, validate } from '../../lib/http.js';
import { emailSchema, passwordSchema } from '../../lib/validation.js';
import * as controllers from './controllers.js';

const router = Router();
const loginSchema = z.object({ email: emailSchema, password: z.string().min(1).max(128) });
const changePasswordSchema = z.object({ currentPassword: z.string().min(1).max(128), newPassword: passwordSchema });
const sessionParamsSchema = z.object({ sessionId: z.string().uuid() });

router.post('/login', verifyTrustedOrigin, validate(loginSchema), asyncHandler(controllers.login));
router.post('/refresh', verifyTrustedOrigin, asyncHandler(controllers.refresh));
router.post('/logout', verifyTrustedOrigin, asyncHandler(controllers.logout));
router.post('/logout-all', requireAuth, asyncHandler(controllers.logoutAll));
router.get('/me', requireAuth, asyncHandler(controllers.getCurrentUser));
router.get('/sessions', requireAuth, asyncHandler(controllers.listSessions));
router.delete(
  '/sessions/:sessionId',
  requireAuth,
  validate(sessionParamsSchema, 'params'),
  asyncHandler(controllers.revokeSession)
);
router.post(
  '/change-password',
  requireAuth,
  validate(changePasswordSchema),
  asyncHandler(controllers.changePassword)
);

export default router;
