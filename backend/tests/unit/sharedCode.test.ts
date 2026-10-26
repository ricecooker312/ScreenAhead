import fs from 'fs';
import path from 'path';

/**
 * The mobile app evaluates questionnaire branching with a verbatim copy of the
 * server code so both sides always agree on which questions are shown.
 * If this fails: cp backend/src/modules/questionnaire/{types,branching}.ts mobile/src/questionnaire/shared/
 */
describe('shared questionnaire code', () => {
  const mobileDir = path.join(__dirname, '../../../mobile/src/questionnaire/shared');
  const exists = fs.existsSync(mobileDir);
  (exists ? it.each(['types.ts', 'branching.ts']) : it.skip.each(['types.ts', 'branching.ts']))('%s matches the mobile copy', (file) => {
    const server = fs.readFileSync(path.join(__dirname, '../../src/modules/questionnaire', file), 'utf8');
    const mobile = fs.readFileSync(path.join(mobileDir, file), 'utf8');
    expect(mobile).toBe(server);
  });
});
