/**
 * Plain-language definitions (aimed at about a 5th-grade reading level).
 * Use <Term word="..."/> in UI text so hard words always come with a meaning.
 */
export const GLOSSARY: Record<string, string> = {
  colorectal: 'the colon and rectum, which make up the large bowel',
  colon: 'the long tube in your belly where poop forms',
  rectum: 'the last part of the bowel, just before the bottom',
  colonoscopy: 'a test where a doctor looks inside your bowel with a thin camera',
  screening: 'checking for cancer before you have any signs',
  polyp: 'a small growth inside the bowel',
  polyps: 'small growths inside the bowel',
  biopsy: 'taking a tiny piece of tissue to look at under a microscope',
  oncologist: 'a doctor who treats cancer',
  gastroenterologist: 'a doctor who treats the stomach and bowels',
  'genetic counselor': 'an expert who explains cancer risk that runs in families',
  hereditary: 'passed down in families',
  inherited: 'passed down from your parents',
  chemotherapy: 'strong medicine that fights cancer',
  radiation: 'energy beams aimed at cancer',
  remission: 'no signs of cancer right now',
  diagnosis: 'when a doctor finds out what is causing a problem',
  symptom: 'a change in your body that you notice',
  severity: 'how strong something feels',
  specialist: 'a doctor who is an expert in one area',
  survivorship: 'life after cancer treatment',
  'primary care doctor': 'your main doctor for everyday health',
  pharmacist: 'a medicine expert at the drugstore',
  acetaminophen: 'a common pain medicine, also called paracetamol',
  telehealth: 'a doctor visit by video or phone',
  triage: 'deciding how soon someone needs care',
  'second opinion': 'asking another expert to check a diagnosis or plan',
};

export function define(word: string): string | undefined {
  return GLOSSARY[word.toLowerCase()];
}
