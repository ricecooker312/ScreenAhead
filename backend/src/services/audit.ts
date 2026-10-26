import { Request } from 'express';
import { AuditLogModel } from '../models';
import { logger } from '../config/logger';

/** Writes an audit entry. Never include health details in `targetType`/`action`. */
export async function audit(
  req: Request | null,
  action: string,
  opts: { targetType?: string; targetId?: string; subjectUser?: string; actor?: string; actorRole?: string } = {},
) {
  try {
    await AuditLogModel.create({
      actor: opts.actor ?? req?.user?.id,
      actorRole: opts.actorRole ?? req?.user?.role,
      action,
      targetType: opts.targetType,
      targetId: opts.targetId,
      subjectUser: opts.subjectUser,
      ip: req?.ip,
    });
  } catch (err) {
    logger.error({ action }, 'Failed to write audit log');
  }
}
