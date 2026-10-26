import { Schema, model, Types } from 'mongoose';

/** User-entered appointments. No booking is made with the provider. */
const appointmentSchema = new Schema(
  {
    user: { type: Types.ObjectId, ref: 'User', required: true },
    provider: { type: Types.ObjectId, ref: 'Provider' },
    providerName: { type: String, trim: true, maxlength: 160 },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    startsAt: { type: Date, required: true },
    location: { type: String, trim: true, maxlength: 200 },
    status: { type: String, enum: ['planned', 'confirmed', 'completed', 'cancelled'], default: 'planned' },
    notes: { type: String, trim: true, maxlength: 2000 },
    questionsToAsk: [{ type: String, trim: true, maxlength: 300 }],
    reminderMinutesBefore: { type: Number, min: 0, max: 20160 },
  },
  { timestamps: true },
);
appointmentSchema.index({ user: 1, startsAt: 1 });

export const AppointmentModel = model('Appointment', appointmentSchema);
