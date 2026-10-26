import { HealthProfileModel } from '../models';
import { ProfileContext } from '../modules/triage/facts';

/** Loads the parts of a user's health profile that the safety engine uses. */
export async function loadProfileContext(userId: string): Promise<ProfileContext> {
  const p = await HealthProfileModel.findOne({ user: userId }).lean();
  if (!p) return {};
  const meds = p.medications ?? [];
  return {
    age: p.age ?? (p.dateOfBirth ? Math.floor((Date.now() - new Date(p.dateOfBirth).getTime()) / (365.25 * 86400000)) : undefined),
    allergies: (p.allergies ?? []).map((a) => a.substance),
    conditions: p.medicalConditions ?? [],
    medicationNames: meds.map((m) => m.name),
    anyMedicationContainsAcetaminophen: meds.some((m) => m.containsAcetaminophen === 'yes')
      ? 'yes'
      : meds.some((m) => m.containsAcetaminophen === 'unknown')
        ? 'unknown'
        : meds.length
          ? 'no'
          : undefined,
    alcohol: p.alcohol ?? undefined,
    hasCancerHistory: (p.cancerHistory ?? []).length > 0,
    inTreatment: (p.currentTreatments ?? []).length > 0,
    hereditarySyndromes: p.hereditarySyndromes ?? [],
    hasFamilyHistory: (p.familyHistory ?? []).length > 0,
  };
}
