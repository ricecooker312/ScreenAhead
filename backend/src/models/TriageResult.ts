import { Schema, model, Types } from 'mongoose';

const triageResultSchema = new Schema(
  {
    user: { type: Types.ObjectId, ref: 'User', required: true },
    questionnaire: { type: Types.ObjectId, ref: 'Questionnaire' },
    rulesetVersion: { type: String, required: true },
    careLevel: { type: String, enum: ['emergency', 'prompt', 'routine', 'insufficient_information'], required: true },
    timeframe: { type: String, enum: ['now', 'today', 'soon', 'routine', 'unknown'] },
    warnings: [{ _id: false, ruleId: String, level: String, title: String, message: String, explanation: String }],
    nextSteps: [{ _id: false, id: String, title: String, detail: String, specialty: String }],
    indicators: { type: Schema.Types.Mixed },
    supportOptions: [{ type: String }],
    medication: { type: Schema.Types.Mixed },
    comfort: { type: Schema.Types.Mixed },
    explanations: [{ _id: false, ruleId: String, text: String }],
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
triageResultSchema.index({ user: 1, createdAt: -1 });

export const TriageResultModel = model('TriageResult', triageResultSchema);
