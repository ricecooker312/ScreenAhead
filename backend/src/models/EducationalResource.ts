import { Schema, model } from 'mongoose';

export const RESOURCE_TOPICS = [
  'symptoms',
  'screening',
  'family_history',
  'diagnostic_tests',
  'pathology',
  'treatment',
  'side_effects',
  'nutrition',
  'emotional_wellbeing',
  'caregiver',
  'survivorship',
  'other_cancers',
  'pain_comfort',
] as const;

const resourceSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true, trim: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    topics: [{ type: String, enum: RESOURCE_TOPICS }],
    summary: { type: String, required: true, maxlength: 600 },
    body: { type: String, maxlength: 20000 }, // plain-language, with definitions in brackets
    readingLevel: { type: String, default: 'grade5' },
    source: {
      name: { type: String, required: true },
      url: { type: String, required: true },
      publishedOrReviewed: { type: String }, // as stated by the source, when available
    },
    lastReviewedAt: { type: Date, required: true },
    reviewedBy: { type: String, default: 'Pending clinical review' },
    status: { type: String, enum: ['draft', 'published', 'retired'], default: 'draft', index: true },
  },
  { timestamps: true },
);
resourceSchema.index({ title: 'text', summary: 'text', body: 'text' });

export const EducationalResourceModel = model('EducationalResource', resourceSchema);
