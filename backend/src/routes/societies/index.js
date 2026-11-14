import { Router } from 'express';
import { z } from 'zod';

import { requireAuth } from '../../middleware/auth.js';
import { requireRoles, requireSocietyScope } from '../../middleware/access.js';
import { USER_ROLES } from '../../lib/constants.js';
import { asyncHandler, validate } from '../../lib/http.js';
import { emailSchema, passwordSchema } from '../../lib/validation.js';
import * as controllers from './controllers.js';

const router = Router();
const createSocietySchema = z.object({
  name: z.string().trim().min(2).max(160),
  address: z.string().trim().max(500).default(''),
  chairmanName: z.string().trim().min(2).max(160),
  chairmanEmail: emailSchema,
  chairmanPassword: passwordSchema
});
const updateSocietySchema = z
  .object({
    name: z.string().trim().min(2).max(160).optional(),
    address: z.string().trim().max(500).optional(),
    isActive: z.boolean().optional()
  })
  .refine((value) => Object.keys(value).length > 0, 'At least one society field is required.');
const visibilitySchema = z.object({ visible: z.boolean() });
const idParams = z.object({ societyId: z.string().uuid() });

router.use(requireAuth);
router.get('/current', requireSocietyScope, asyncHandler(controllers.getCurrentSociety));
router.patch(
  '/current/finance-visibility',
  requireRoles(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  requireSocietyScope,
  validate(visibilitySchema),
  asyncHandler(controllers.setFinanceVisibility)
);
router.get('/', requireRoles(USER_ROLES.SUPER_ADMIN), asyncHandler(controllers.listSocieties));
router.post(
  '/',
  requireRoles(USER_ROLES.SUPER_ADMIN),
  validate(createSocietySchema),
  asyncHandler(controllers.createSociety)
);
router.get('/:societyId', validate(idParams, 'params'), asyncHandler(controllers.getSociety));
router.patch(
  '/:societyId',
  requireRoles(USER_ROLES.SUPER_ADMIN),
  validate(idParams, 'params'),
  validate(updateSocietySchema),
  asyncHandler(controllers.updateSociety)
);
router.delete(
  '/:societyId',
  requireRoles(USER_ROLES.SUPER_ADMIN),
  validate(idParams, 'params'),
  asyncHandler(controllers.deactivateSociety)
);

export default router;
