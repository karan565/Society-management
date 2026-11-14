import { prisma } from '../db.js';
import { USER_ROLES } from '../lib/constants.js';
import { AppError, asyncHandler } from '../lib/http.js';

export const requireRoles = (...roles) => (req, _res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    next(new AppError(403, 'You do not have permission to perform this action.', 'FORBIDDEN'));
    return;
  }
  next();
};

export const requireSocietyScope = asyncHandler(async (req, _res, next) => {
  if (req.user.role === USER_ROLES.SUPER_ADMIN) {
    const societyId = req.get('x-society-id') || req.params.societyId || req.body?.societyId || req.query.societyId;
    if (!societyId) throw new AppError(400, 'Select a society with the X-Society-Id header.', 'SOCIETY_SCOPE_REQUIRED');
    const society = await prisma.society.findUnique({ where: { id: societyId }, select: { id: true, isActive: true } });
    if (!society) throw new AppError(404, 'The selected society does not exist.', 'SOCIETY_NOT_FOUND');
    if (!society.isActive) throw new AppError(409, 'The selected society is inactive.', 'SOCIETY_INACTIVE');
    req.societyId = society.id;
    next();
    return;
  }

  if (!req.user.societyId) throw new AppError(403, 'This account is not assigned to a society.', 'SOCIETY_REQUIRED');
  req.societyId = req.user.societyId;
  next();
});
