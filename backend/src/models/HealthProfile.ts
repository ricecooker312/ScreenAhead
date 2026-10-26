import { Schema, model, Types, InferSchemaType } from 'mongoose';

/**
 * Every field except `user` is optional. The app explains why each item is
 * requested and works without most of them (data minimisation).
 */
const cancerHistorySchema = new Schema(
  {
    cancerType: { type: String, trim: true, maxlength: 120 },
    diagnosedYear: { type: Number, min: 1900, max: 2100 },
    status: { type: String, enum: ['current', 'remission', 'unknown'] },
    treatments: [{ type: String, trim: true, maxlength: 120 }],
  },
  { _id: false },
);

const familyHistorySchema = new Schema(
  {
    relation: { type: String, enum: ['parent', 'sibling', 'child', 'grandparent', 'aunt_uncle', 'other'] },
    condition: { type: String, trim: true, maxlength: 120 },
    ageAtDiagnosis: { type: Number, min: 0, max: 120 },
  },
  { _id: false },
);

const medicationSchema = new Schema(
  {
    name: { type: String, trim: true, maxlength: 120, required: true },
    note: { type: String, trim: true, maxlength: 300 },
    containsAcetaminophen: { type: String, enum: ['yes', 'no', 'unknown'], default: 'unknown' },
  },
  { _id: false },
);

const allergySchema = new Schema(
  {
    substance: { type: String, trim: true, maxlength: 120, required: true },
    reaction: { type: String, trim: true, maxlength: 300 },
  },
  { _id: false },
);

const providerRefSchema = new Schema(
  {
    name: { type: String, trim: true, maxlength: 120 },
    role: { type: String, trim: true, maxlength: 120 },
    phone: { type: String, trim: true, maxlength: 30 },
  },
  { _id: false },
);

const healthProfileSchema = new Schema(
  {
    user: { type: Types.ObjectId, ref: 'User', required: true, unique: true },
    dateOfBirth: { type: Date },
    age: { type: Number, min: 0, max: 120 },
    heightCm: { type: Number, min: 30, max: 260 },
    weightKg: { type: Number, min: 2, max: 400 },
    medicalConditions: [{ type: String, trim: true, maxlength: 120 }],
    cancerHistory: [cancerHistorySchema],
    currentTreatments: [{ type: String, trim: true, maxlength: 120 }],
    previousTreatments: [{ type: String, trim: true, maxlength: 120 }],
    allergies: [allergySchema],
    medications: [medicationSchema],
    familyHistory: [familyHistorySchema],
    hereditarySyndromes: [{ type: String, trim: true, maxlength: 120 }],
    geneticTestSummary: { type: String, trim: true, maxlength: 500 },
    smoking: { type: String, enum: ['never', 'former', 'current', 'prefer_not'] },
    alcohol: { type: String, enum: ['none', 'occasional', 'one_two_daily', 'three_plus_daily', 'prefer_not'] },
    dietPattern: { type: String, trim: true, maxlength: 500 },
    bowelHabits: { type: String, trim: true, maxlength: 500 },
    existingProviders: [providerRefSchema],
    postalCode: { type: String, trim: true, maxlength: 12 },
  },
  { timestamps: true },
);

export type HealthProfile = InferSchemaType<typeof healthProfileSchema>;
export const HealthProfileModel = model('HealthProfile', healthProfileSchema);
