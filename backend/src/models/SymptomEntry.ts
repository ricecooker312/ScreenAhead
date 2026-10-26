import { Schema, model, Types } from 'mongoose';

const symptomEntrySchema = new Schema(
  {
    user: { type: Types.ObjectId, ref: 'User', required: true },
    symptomType: { type: String, required: true, trim: true, maxlength: 80 },
    severity: { type: Number, min: 1, max: 10 }, // omitted = "not applicable"
    startDate: { type: Date },
    durationText: { type: String, trim: true, maxlength: 120 },
    frequency: { type: String, enum: ['constant', 'intermittent', 'occasional', 'once'] },
    associatedSymptoms: [{ type: String, trim: true, maxlength: 80 }],
    changeSinceLast: { type: String, enum: ['better', 'same', 'worse', 'first_entry'] },
    interventions: [
      {
        _id: false,
        measure: { type: String, trim: true, maxlength: 120 },
        effect: { type: String, enum: ['helped', 'no_difference', 'worse', 'unsure'] },
      },
    ],
    notes: { type: String, trim: true, maxlength: 2000 },
    notesForAppointment: { type: String, trim: true, maxlength: 2000 },
    recordedAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true },
);
symptomEntrySchema.index({ user: 1, recordedAt: -1 });

export const SymptomEntryModel = model('SymptomEntry', symptomEntrySchema);
