import { Router } from 'express';
import { z } from 'zod';

import { requireAuth } from '../../middleware/auth.js';
import { requireRoles, requireSocietyScope } from '../../middleware/access.js';
import { USER_ROLES } from '../../lib/constants.js';
import { asyncHandler, validate } from '../../lib/http.js';
import { dateSchema, positiveAmountSchema } from '../../lib/validation.js';
import * as controllers from './controllers.js';

const router = Router();
const transactionSchema = z.object({
  type: z.enum(['income', 'expense']),
  title: z.string().trim().min(1).max(160),
  amount: positiveAmountSchema,
  date: dateSchema,
  notes: z.string().trim().max(2000).default('')
});
const idParams = z.object({ transactionId: z.string().uuid() });

router.use(requireAuth, requireSocietyScope);

router.get('/balance', asyncHandler(controllers.getBalance));
router.get('/monthly', asyncHandler(controllers.getMonthlySummary));
router.get('/statement', asyncHandler(controllers.getStatement));
router.get('/transactions', asyncHandler(controllers.listTransactions));
router.get('/transactions/:transactionId', validate(idParams, 'params'), asyncHandler(controllers.getTransaction));
router.post(
  '/transactions',
  requireRoles(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  validate(transactionSchema),
  asyncHandler(controllers.createTransaction)
);
router.patch(
  '/transactions/:transactionId',
  requireRoles(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  validate(idParams, 'params'),
  validate(transactionSchema),
  asyncHandler(controllers.updateTransaction)
);
router.delete(
  '/transactions/:transactionId',
  requireRoles(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  validate(idParams, 'params'),
  asyncHandler(controllers.deleteTransaction)
);

export default router;
