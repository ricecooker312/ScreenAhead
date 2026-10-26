import { HealthProfileModel, SymptomEntryModel, TriageResultModel, AppointmentModel, UserModel } from '../models';

const SECTION_NAMES = ['profile', 'medications', 'symptoms', 'triage', 'appointments'] as const;
type SectionName = (typeof SECTION_NAMES)[number];

/**
 * Builds a readable summary a person can share with their clinician. Only the
 * requested sections are included. Contains only what the user entered and
 * what the app suggested — never a diagnosis.
 */
export async function buildHealthSummary(userId: string, requested: string[]) {
  const sections = new Set(requested.filter((s): s is SectionName => (SECTION_NAMES as readonly string[]).includes(s)));
  const [user, profile, symptoms, triage, appointments] = await Promise.all([
    UserModel.findById(userId).select('displayName').lean(),
    sections.has('profile') || sections.has('medications') ? HealthProfileModel.findOne({ user: userId }).lean() : null,
    sections.has('symptoms') ? SymptomEntryModel.find({ user: userId }).sort({ recordedAt: -1 }).limit(20).lean() : [],
    sections.has('triage') ? TriageResultModel.findOne({ user: userId }).sort({ createdAt: -1 }).lean() : null,
    sections.has('appointments')
      ? AppointmentModel.find({ user: userId, startsAt: { $gte: new Date(Date.now() - 86400000) } }).sort({ startsAt: 1 }).limit(10).lean()
      : [],
  ]);

  const lines: string[] = [];
  lines.push(`Health summary${user?.displayName ? ` for ${user.displayName}` : ''}`);
  lines.push(`Created ${new Date().toLocaleDateString('en-US')} with CareCompass. Patient-reported information, not a medical record.`);

  if (sections.has('profile') && profile) {
    lines.push('', 'ABOUT ME');
    if (profile.age) lines.push(`Age: ${profile.age}`);
    if (profile.medicalConditions?.length) lines.push(`Conditions: ${profile.medicalConditions.join(', ')}`);
    for (const c of profile.cancerHistory ?? []) lines.push(`Cancer history: ${c.cancerType ?? 'type not given'} (${c.status ?? 'status unknown'})`);
    if (profile.currentTreatments?.length) lines.push(`Current treatments: ${profile.currentTreatments.join(', ')}`);
    for (const fh of profile.familyHistory ?? []) lines.push(`Family history: ${fh.relation ?? 'relative'} — ${fh.condition ?? ''}`);
    if (profile.hereditarySyndromes?.length) lines.push(`Inherited conditions: ${profile.hereditarySyndromes.join(', ')}`);
  }
  if (sections.has('medications') && profile) {
    lines.push('', 'MEDICINES AND ALLERGIES');
    lines.push(profile.medications?.length ? `Medicines: ${profile.medications.map((m) => m.name).join(', ')}` : 'Medicines: none recorded');
    lines.push(
      profile.allergies?.length
        ? `Allergies: ${profile.allergies.map((a) => (a.reaction ? `${a.substance} (${a.reaction})` : a.substance)).join(', ')}`
        : 'Allergies: none recorded',
    );
  }
  if (sections.has('symptoms')) {
    lines.push('', 'RECENT SYMPTOMS (self-reported)');
    if (!symptoms.length) lines.push('None logged.');
    for (const s of symptoms) {
      lines.push(
        `${new Date(s.recordedAt).toLocaleDateString('en-US')}: ${s.symptomType}` +
          `${s.severity ? `, severity ${s.severity}/10` : ''}${s.frequency ? `, ${s.frequency}` : ''}${s.changeSinceLast ? `, ${s.changeSinceLast}` : ''}`,
      );
      if (s.notesForAppointment) lines.push(`   Note: ${s.notesForAppointment}`);
    }
  }
  if (sections.has('triage') && triage) {
    lines.push('', 'LAST QUESTIONNAIRE GUIDANCE (not a diagnosis)');
    lines.push(`Date: ${new Date(triage.createdAt!).toLocaleDateString('en-US')} · Suggested care level: ${triage.careLevel}`);
    for (const w of triage.warnings ?? []) lines.push(`- ${w.title}`);
  }
  if (sections.has('appointments')) {
    lines.push('', 'UPCOMING APPOINTMENTS');
    if (!appointments.length) lines.push('None recorded.');
    for (const a of appointments) {
      lines.push(`${new Date(a.startsAt).toLocaleString('en-US')}: ${a.title}${a.providerName ? ` with ${a.providerName}` : ''}`);
      for (const q of a.questionsToAsk ?? []) lines.push(`   Question: ${q}`);
    }
  }

  return {
    generatedAt: new Date(),
    sections: Array.from(sections),
    text: lines.join('\n'),
    data: {
      profile: sections.has('profile') ? profile : undefined,
      medications: sections.has('medications') ? { medications: profile?.medications ?? [], allergies: profile?.allergies ?? [] } : undefined,
      symptoms: sections.has('symptoms') ? symptoms : undefined,
      triage: sections.has('triage') ? triage : undefined,
      appointments: sections.has('appointments') ? appointments : undefined,
    },
  };
}
