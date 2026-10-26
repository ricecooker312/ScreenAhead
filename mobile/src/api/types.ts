export type Role = 'patient' | 'clinician' | 'admin';
export type CareLevel = 'emergency' | 'prompt' | 'routine' | 'insufficient_information';

export interface User {
  _id: string;
  email: string;
  displayName?: string;
  role: Role;
  onboardingCategories: string[];
  onboardingComplete: boolean;
  contactPhone?: string;
  settings: { preferredLanguage: string; largeText: boolean; reduceMotion: boolean; showDefinitions: boolean };
  clinician?: { credentials?: string; specialty?: string; organization?: string; verificationStatus: 'pending' | 'verified' | 'rejected' };
}

export interface Warning {
  ruleId: string;
  level: 'emergency' | 'prompt' | 'info';
  timeframe: string;
  title: string;
  message: string;
  explanation: string;
}

export interface NextStep {
  id: string;
  title: string;
  detail: string;
  specialty?: string;
}

export interface Triage {
  careLevel: CareLevel;
  timeframe: string;
  headline: string;
  warnings: Warning[];
  nextSteps: NextStep[];
  medication: { status: string; title: string; message: string; reasons: string[]; cautions: string[] };
  comfort: { show: boolean; note?: string; options: { id: string; title: string; detail: string }[] };
  disclaimers: string[];
  rulesetVersion: string;
}

export interface Recommendation {
  category: string;
  title: string;
  body: string;
  bullets?: string[];
  resourceTopics: string[];
  specialties: string[];
}

export interface Provider {
  _id: string;
  name: string;
  credentials?: string;
  specialties: string[];
  focusAreas?: string[];
  organization?: string;
  location?: { addressLine?: string; city?: string; state?: string; postalCode?: string };
  contact?: { phone?: string; email?: string };
  website?: string;
  bookingUrl?: string;
  languages: { values: string[] } | null;
  telehealth: { value: boolean } | null;
  insuranceAccepted: { values: string[] } | null;
  verification: { status: 'verified' | 'unverified' | 'demo'; lastVerifiedAt?: string; source?: string };
  isDemo: boolean;
  label: string;
  saved?: boolean;
}

export interface Resource {
  _id: string;
  slug: string;
  title: string;
  topics: string[];
  summary: string;
  body?: string;
  source: { name: string; url: string; publishedOrReviewed?: string };
  lastReviewedAt: string;
  reviewedBy?: string;
}

export interface SymptomEntry {
  _id: string;
  symptomType: string;
  severity?: number;
  frequency?: string;
  changeSinceLast?: string;
  associatedSymptoms?: string[];
  interventions?: { measure: string; effect: string }[];
  notes?: string;
  notesForAppointment?: string;
  recordedAt: string;
}

export interface Appointment {
  _id: string;
  title: string;
  startsAt: string;
  providerName?: string;
  location?: string;
  status: string;
  notes?: string;
  questionsToAsk?: string[];
}

export interface Paged<T> {
  items: T[];
  page: number;
  total: number;
  totalPages: number;
}

export const SPECIALTY_LABELS: Record<string, string> = {
  medical_oncology: 'Medical oncologist (cancer medicine doctor)',
  gastroenterology: 'Gastroenterologist (stomach and bowel doctor)',
  colorectal_surgery: 'Colorectal surgeon (bowel surgery doctor)',
  surgical_oncology: 'Surgical oncologist (cancer surgery doctor)',
  radiation_oncology: 'Radiation oncologist (radiation treatment doctor)',
  genetic_counseling: 'Genetic counselor (family risk expert)',
  primary_care: 'Primary care doctor (your main doctor)',
  oncology_nursing_navigation: 'Oncology nurse navigator (cancer care guide)',
  oncology_dietitian: 'Oncology dietitian (food expert)',
  mental_health: 'Counselor or therapist',
  rehabilitation_survivorship: 'Survivorship and rehab services',
};

export const SPECIALTY_SHORT: Record<string, string> = {
  medical_oncology: 'Oncologist',
  gastroenterology: 'Gastroenterologist',
  colorectal_surgery: 'Colorectal surgeon',
  surgical_oncology: 'Surgical oncologist',
  radiation_oncology: 'Radiation oncologist',
  genetic_counseling: 'Genetic counselor',
  primary_care: 'Primary care',
  oncology_nursing_navigation: 'Nurse navigator',
  oncology_dietitian: 'Dietitian',
  mental_health: 'Counseling',
  rehabilitation_survivorship: 'Survivorship',
};
