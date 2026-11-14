import { Router } from 'express';
import { z } from 'zod';

import { requireAuth } from '../../middleware/auth.js';
import { requireRoles, requireSocietyScope } from '../../middleware/access.js';
import { USER_ROLES } from '../../lib/constants.js';
import { asyncHandler, validate } from '../../lib/http.js';
import * as controllers from './controllers.js';

const router = Router();
const createSchema = z.object({
  type: z.enum(['Complaint', 'Suggestion']),
  title: z.string().trim().min(1).max(100),
  description: z.string().trim().min(1).max(2000)
});
const statusSchema = z.object({
  status: z.enum(['in progress', 'rejected', 'closed', 'completed'])
});
const idParams = z.object({ complaintId: z.string().uuid() });

router.use(requireAuth, requireSocietyScope);

router.get('/', asyncHandler(controllers.listComplaints));
router.get('/:complaintId', validate(idParams, 'params'), asyncHandler(controllers.getComplaint));
router.post(
  '/',
  requireRoles(USER_ROLES.RESIDENT),
  validate(createSchema),
  asyncHandler(controllers.createComplaint)
);
router.patch(
  '/:complaintId/status',
  validate(idParams, 'params'),
  validate(statusSchema),
  asyncHandler(controllers.updateComplaintStatus)
);
router.delete('/:complaintId', validate(idParams, 'params'), asyncHandler(controllers.deleteComplaint));

export default router;
