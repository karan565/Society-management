import { Router } from 'express';
import { z } from 'zod';

import { requireAuth } from '../../middleware/auth.js';
import { requireRoles, requireSocietyScope } from '../../middleware/access.js';
import { USER_ROLES } from '../../lib/constants.js';
import { asyncHandler, validate } from '../../lib/http.js';
import { monthSchema, paymentInputSchema, positiveAmountSchema } from '../../lib/validation.js';
import * as controllers from './controllers.js';

const router = Router();
const scheduleSchema = z.object({
  month: monthSchema,
  amount: positiveAmountSchema,
  applyPermanently: z.boolean().default(false)
});
const idParams = z.object({ billId: z.string().uuid() });

router.use(requireAuth, requireSocietyScope);
router.get('/bills', asyncHandler(controllers.listBills));
router.get('/bills/:billId', validate(idParams, 'params'), asyncHandler(controllers.getBill));
router.post(
  '/schedule',
  requireRoles(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  validate(scheduleSchema),
  asyncHandler(controllers.setMaintenanceSchedule)
);
router.post(
  '/bills/:billId/payment-request',
  requireRoles(USER_ROLES.RESIDENT),
  validate(idParams, 'params'),
  validate(paymentInputSchema),
  asyncHandler(controllers.submitPaymentRequest)
);
router.post(
  '/bills/:billId/mark-paid',
  requireRoles(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  validate(idParams, 'params'),
  validate(paymentInputSchema),
  asyncHandler(controllers.markBillPaid)
);
router.post(
  '/bills/:billId/accept-payment-request',
  requireRoles(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  validate(idParams, 'params'),
  asyncHandler(controllers.acceptPaymentRequest)
);
router.post(
  '/bills/:billId/revert-payment',
  requireRoles(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  validate(idParams, 'params'),
  asyncHandler(controllers.revertBillPayment)
);
router.get('/bills/:billId/payments', validate(idParams, 'params'), asyncHandler(controllers.listBillPayments));

export default router;
