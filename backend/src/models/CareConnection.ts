import { Schema, model, Types } from 'mongoose';

export const SHARE_SCOPES = ['summary', 'symptoms', 'triage', 'medications', 'contact', 'messages'] as const;
export type ShareScope = (typeof SHARE_SCOPES)[number];

/**
 * A patient-controlled link between a patient and a verified clinician.
 * Created as `pending` with a one-time share code; the clinician redeems it.
 * The patient can change scopes or revoke at any time.
 */
const careConnectionSchema = new Schema(
  {
    patient: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    clinician: { type: Types.ObjectId, ref: 'User', index: true },
    status: { type: String, enum: ['pending', 'active', 'revoked', 'expired'], default: 'pending' },
    scopes: [{ type: String, enum: SHARE_SCOPES }],
    codeHash: { type: String, index: true, sparse: true },
    codeExpiresAt: { type: Date },
    acceptedAt: { type: Date },
    revokedAt: { type: Date },
    revokedBy: { type: String, enum: ['patient', 'clinician'] },
  },
  { timestamps: true },
);
careConnectionSchema.index({ patient: 1, clinician: 1, status: 1 });
export const CareConnectionModel = model('CareConnection', careConnectionSchema);

const messageSchema = new Schema(
  {
    connection: { type: Types.ObjectId, ref: 'CareConnection', required: true },
    sender: { type: Types.ObjectId, ref: 'User', required: true },
    senderRole: { type: String, enum: ['patient', 'clinician'], required: true },
    kind: { type: String, enum: ['text', 'check_in_request', 'appointment_request'], default: 'text' },
    body: { type: String, required: true, trim: true, maxlength: 4000 },
    readAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
messageSchema.index({ connection: 1, createdAt: -1 });
export const MessageModel = model('Message', messageSchema);
