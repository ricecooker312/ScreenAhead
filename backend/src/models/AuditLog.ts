import { Schema, model, Types } from 'mongoose';
import { env } from '../config/env';

/**
 * Records who accessed or changed what. Never stores health details —
 * only actor, action, target type/id and timestamps.
 */
const auditLogSchema = new Schema(
  {
    actor: { type: Types.ObjectId, ref: 'User' },
    actorRole: { type: String },
    action: { type: String, required: true },
    targetType: { type: String },
    targetId: { type: String },
    subjectUser: { type: Types.ObjectId, ref: 'User' }, // whose data was touched
    ip: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: env.AUDIT_LOG_RETENTION_DAYS * 86400 });
auditLogSchema.index({ subjectUser: 1, createdAt: -1 });

export const AuditLogModel = model('AuditLog', auditLogSchema);
