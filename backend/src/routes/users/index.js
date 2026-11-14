import { Router } from 'express';
import { z } from 'zod';

import { requireAuth } from '../../middleware/auth.js';
import { requireRoles, requireSocietyScope } from '../../middleware/access.js';
import { USER_ROLES } from '../../lib/constants.js';
import { asyncHandler, validate } from '../../lib/http.js';
import { emailSchema, passwordSchema } from '../../lib/validation.js';
import * as controllers from './controllers.js';

const router = Router();
const createUserSchema = z
  .object({
    societyId: z.string().uuid().optional(),
    name: z.string().trim().min(2).max(160),
    email: emailSchema,
    role: z.enum(['admin', 'resident']).default('resident'),
    title: z.string().trim().max(100).default(''),
    apartment: z.string().trim().max(80).default(''),
    phone: z.string().trim().max(40).default(''),
    password: passwordSchema
  })
  .refine((value) => value.role !== 'admin' || Boolean(value.title.trim()), 'Enter the committee position for an admin.')
  .refine((value) => value.role !== 'resident' || Boolean(value.apartment.trim()), 'Enter the apartment or unit for a resident.');
const updateUserSchema = z
  .object({
    name: z.string().trim().min(2).max(160).optional(),
    title: z.string().trim().max(100).optional(),
    apartment: z.string().trim().max(80).optional(),
    phone: z.string().trim().max(40).optional()
  })
  .refine((value) => Object.keys(value).length > 0, 'At least one profile field is required.');
const ownProfileSchema = z
  .object({
    name: z.string().trim().min(2).max(160).optional(),
    phone: z.string().trim().max(40).optional()
  })
  .refine((value) => Object.keys(value).length > 0, 'At least one profile field is required.');
const accessSchema = z.object({ isActive: z.boolean() });
const resetPasswordSchema = z.object({ password: passwordSchema });
const idParams = z.object({ userId: z.string().uuid() });

router.use(requireAuth);
router.get('/', requireRoles(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN), asyncHandler(controllers.listUsers));
router.post(
  '/',
  requireRoles(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  validate(createUserSchema),
  asyncHandler(controllers.createUser)
);
router.get(
  '/:userId',
  requireRoles(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  requireSocietyScope,
  validate(idParams, 'params'),
  asyncHandler(controllers.getUser)
);
router.patch('/me', validate(ownProfileSchema), asyncHandler(controllers.updateOwnProfile));
router.patch(
  '/:userId',
  requireRoles(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  requireSocietyScope,
  validate(idParams, 'params'),
  validate(updateUserSchema),
  asyncHandler(controllers.updateUser)
);
router.patch(
  '/:userId/access',
  requireRoles(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  requireSocietyScope,
  validate(idParams, 'params'),
  validate(accessSchema),
  asyncHandler(controllers.updateUserAccess)
);
router.put(
  '/:userId/password',
  requireRoles(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  requireSocietyScope,
  validate(idParams, 'params'),
  validate(resetPasswordSchema),
  asyncHandler(controllers.resetUserPassword)
);
router.delete(
  '/:userId',
  requireRoles(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN),
  requireSocietyScope,
  validate(idParams, 'params'),
  asyncHandler(controllers.deactivateUser)
);

export default router;
