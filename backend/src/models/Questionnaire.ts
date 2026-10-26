import { Schema, model, Types } from 'mongoose';

/**
 * Original answers are stored verbatim in `responses`. Derived indicators and
 * recommendations live in TriageResult so the raw answers are never overwritten.
 */
const questionnaireSchema = new Schema(
  {
    user: { type: Types.ObjectId, ref: 'User', required: true },
    version: { type: String, required: true },
    questionsPresented: [{ type: String }],
    responses: { type: Schema.Types.Mixed, default: {} },
    status: { type: String, enum: ['in_progress', 'submitted', 'abandoned'], default: 'in_progress' },
    currentSection: { type: String },
    emergencyShownAt: { type: Date },
    submittedAt: { type: Date },
  },
  { timestamps: true, minimize: false },
);
questionnaireSchema.index({ user: 1, createdAt: -1 });

export const QuestionnaireModel = model('Questionnaire', questionnaireSchema);
