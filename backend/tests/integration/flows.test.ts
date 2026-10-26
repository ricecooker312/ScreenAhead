import { api, startDb, stopDb, clearDb, registerPatient, registerClinician, makeAdmin, auth } from './setup';
import { SAFE_URGENT } from '../helpers/answers';
import { seed } from '../../src/seed/seed';
import { ProviderModel } from '../../src/models';

beforeAll(startDb);
afterAll(stopDb);
afterEach(clearDb);

async function startQuestionnaire(token: string) {
  const res = await api().post('/api/questionnaires').set(auth(token));
  expect(res.status).toBe(201);
  return res.body.questionnaire._id as string;
}

describe('questionnaire flow', () => {
  it('shows an emergency immediately after the first safety answer, before the rest is complete', async () => {
    const p = await registerPatient();
    const id = await startQuestionnaire(p.token);
    const res = await api().patch(`/api/questionnaires/${id}`).set(auth(p.token)).send({ answers: { breathing: 'severe' } });
    expect(res.status).toBe(200);
    expect(res.body.safetyCheck.emergency).toBe(true);
    expect(res.body.safetyCheck.warnings[0].ruleId).toBe('E-BREATHING');

    // Submitting an incomplete questionnaire with an emergency still returns the emergency result.
    const submit = await api().post(`/api/questionnaires/${id}/submit`).set(auth(p.token));
    expect(submit.status).toBe(200);
    expect(submit.body.triage.careLevel).toBe('emergency');
    expect(submit.body.recommendations).toHaveLength(1);
  });

  it('rejects invalid severity values', async () => {
    const p = await registerPatient();
    const id = await startQuestionnaire(p.token);
    for (const severity of [0, 11, 5.5, 'high']) {
      const res = await api().patch(`/api/questionnaires/${id}`).set(auth(p.token)).send({ answers: { severity } });
      expect(res.status).toBe(400);
    }
  });

  it('refuses to submit a non-emergency questionnaire with missing required answers', async () => {
    const p = await registerPatient();
    const id = await startQuestionnaire(p.token);
    await api().patch(`/api/questionnaires/${id}`).set(auth(p.token)).send({ answers: { breathing: 'normal' } });
    const res = await api().post(`/api/questionnaires/${id}/submit`).set(auth(p.token));
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d: any) => d.questionId)).toContain('symptoms');
  });

  it('full routine flow stores original answers and a separate triage result; hidden answers are pruned', async () => {
    const p = await registerPatient();
    const id = await startQuestionnaire(p.token);
    await api()
      .patch(`/api/questionnaires/${id}`)
      .set(auth(p.token))
      .send({
        answers: {
          ...SAFE_URGENT,
          symptoms: ['fatigue'],
          fatigue_level: 'mild',
          severity: 2,
          duration: 'lt_1w',
          progression: 'improved',
          comfort_tried: 'no',
          comfort_effect: 'helped', // hidden by branching → must be dropped
          desired_help: ['understand_next_steps'],
        },
      });
    const submit = await api().post(`/api/questionnaires/${id}/submit`).set(auth(p.token));
    expect(submit.status).toBe(200);
    expect(submit.body.triage.careLevel).toBe('routine');
    expect(submit.body.questionnaire.responses.comfort_effect).toBeUndefined();
    expect(submit.body.questionnaire.responses.severity).toBe(2);
    expect(submit.body.questionnaire.status).toBe('submitted');

    const history = await api().get('/api/triage/history').set(auth(p.token));
    expect(history.body.items).toHaveLength(1);
    expect(history.body.items[0].rulesetVersion).toBeDefined();

    expect((await api().post(`/api/questionnaires/${id}/submit`).set(auth(p.token))).status).toBe(409);
  });

  it('stateless evaluate endpoint returns guidance without storing it', async () => {
    const p = await registerPatient();
    const res = await api()
      .post('/api/triage/evaluate')
      .set(auth(p.token))
      .send({ answers: { ...SAFE_URGENT, symptoms: ['weight_loss'], duration: '3w_3m', progression: 'same', desired_help: ['find_specialist'] } });
    expect(res.status).toBe(200);
    expect(res.body.triage.careLevel).toBe('prompt');
    expect((await api().get('/api/triage/history').set(auth(p.token))).body.items).toHaveLength(0);
  });

  it('dashboard never includes numeric risk indicators', async () => {
    const p = await registerPatient();
    const id = await startQuestionnaire(p.token);
    await api()
      .patch(`/api/questionnaires/${id}`)
      .set(auth(p.token))
      .send({ answers: { ...SAFE_URGENT, symptoms: ['bowel_change'], severity: 3, duration: 'gt_3m', progression: 'same', desired_help: ['find_specialist'] } });
    await api().post(`/api/questionnaires/${id}/submit`).set(auth(p.token));
    const dash = await api().get('/api/dashboard').set(auth(p.token));
    expect(dash.status).toBe(200);
    expect(dash.body.careLevel).toBe('prompt');
    expect(JSON.stringify(dash.body)).not.toMatch(/potentialToWorsen|indicators/);
  });
});

describe('symptom tracking', () => {
  it('validates severity and nudges a safety check for warning-type entries', async () => {
    const p = await registerPatient();
    expect((await api().post('/api/symptoms').set(auth(p.token)).send({ symptomType: 'Pain', severity: 12 })).status).toBe(400);
    const ok = await api().post('/api/symptoms').set(auth(p.token)).send({ symptomType: 'Pain', severity: 3, changeSinceLast: 'better' });
    expect(ok.status).toBe(201);
    expect(ok.body.safetyNudge).toBeNull();
    const bleed = await api().post('/api/symptoms').set(auth(p.token)).send({ symptomType: 'Rectal bleeding', severity: 2 });
    expect(bleed.body.safetyNudge).toMatch(/safety check/);
  });

  it('paginates', async () => {
    const p = await registerPatient();
    for (let i = 0; i < 5; i++) await api().post('/api/symptoms').set(auth(p.token)).send({ symptomType: `S${i}` });
    const res = await api().get('/api/symptoms').query({ limit: 2, page: 2 }).set(auth(p.token));
    expect(res.body.items).toHaveLength(2);
    expect(res.body.total).toBe(5);
    expect(res.body.totalPages).toBe(3);
  });
});

describe('provider directory', () => {
  beforeEach(() => seed());

  it('filters by specialty, telehealth and language, and labels demo data', async () => {
    const p = await registerPatient();
    const gi = await api().get('/api/providers').query({ specialty: 'gastroenterology' }).set(auth(p.token));
    expect(gi.status).toBe(200);
    expect(gi.body.items.length).toBeGreaterThan(0);
    for (const item of gi.body.items) {
      expect(item.specialties).toContain('gastroenterology');
      expect(item.label).toMatch(/Demonstration data/);
    }
    const tele = await api().get('/api/providers').query({ telehealth: 'true', language: 'spanish' }).set(auth(p.token));
    for (const item of tele.body.items) {
      expect(item.telehealth.value).toBe(true);
      expect(item.languages.values.map((l: string) => l.toLowerCase())).toContain('spanish');
    }
  });

  it('verifiedOnly excludes demo and unverified providers; unverified attributes are hidden', async () => {
    const p = await registerPatient();
    await ProviderModel.create({
      name: 'Unverified Clinic',
      specialties: ['primary_care'],
      telehealth: { value: true, verified: false },
      languages: { values: ['Klingon'], verified: false },
    });
    const all = await api().get('/api/providers').query({ q: 'Unverified' }).set(auth(p.token));
    const item = all.body.items.find((i: any) => i.name === 'Unverified Clinic');
    expect(item.telehealth).toBeNull();
    expect(item.languages).toBeNull();
    expect(item.label).toMatch(/Not yet verified/);

    const verified = await api().get('/api/providers').query({ verifiedOnly: 'true' }).set(auth(p.token));
    expect(verified.body.items).toHaveLength(0);
  });

  it('admin verification is audited and demo records cannot be verified', async () => {
    const admin = await makeAdmin();
    const real = await api()
      .post('/api/admin/providers')
      .set(auth(admin.token))
      .send({ name: 'Real Test Clinic', specialties: ['primary_care'], website: 'https://example.org' });
    expect(real.body.verification.status).toBe('unverified');
    const v = await api().post(`/api/admin/providers/${real.body._id}/verify`).set(auth(admin.token)).send({ status: 'verified', source: 'State license lookup' });
    expect(v.body.verification.status).toBe('verified');
    expect(v.body.verification.lastVerifiedAt).toBeDefined();

    const demo = await ProviderModel.findOne({ isDemo: true });
    expect((await api().post(`/api/admin/providers/${demo!._id}/verify`).set(auth(admin.token)).send({ status: 'verified', source: 'x y z' })).status).toBe(400);
  });

  it('saves and unsaves providers', async () => {
    const p = await registerPatient();
    const provider = await ProviderModel.findOne();
    expect((await api().post(`/api/providers/${provider!._id}/save`).set(auth(p.token))).status).toBe(201);
    const saved = await api().get('/api/providers/saved').set(auth(p.token));
    expect(saved.body.items).toHaveLength(1);
    expect((await api().delete(`/api/providers/${provider!._id}/save`).set(auth(p.token))).status).toBe(204);
    expect((await api().get('/api/providers/saved').set(auth(p.token))).body.items).toHaveLength(0);
  });
});

describe('educational resources', () => {
  beforeEach(() => seed({ resourcesOnly: true }));
  it('lists, filters, searches and returns sources without authentication', async () => {
    const list = await api().get('/api/resources').query({ topic: 'screening' });
    expect(list.status).toBe(200);
    expect(list.body.items.length).toBeGreaterThan(0);
    expect(list.body.items[0].source.url).toMatch(/^https:\/\//);
    const one = await api().get('/api/resources/screening-basics');
    expect(one.body.lastReviewedAt).toBeDefined();
    expect(one.body.notice).toMatch(/not personal medical advice/);
    const search = await api().get('/api/resources/search').query({ q: 'colonoscopy' });
    expect(search.body.items.length).toBeGreaterThan(0);
  });
});

describe('clinician connections', () => {
  async function connect(scopes = ['summary', 'symptoms', 'triage', 'messages']) {
    const patient = await registerPatient();
    const doc = await registerClinician();
    const invite = await api().post('/api/connections/invite').set(auth(patient.token)).send({ scopes });
    expect(invite.status).toBe(201);
    expect(invite.body.code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    const accept = await api().post('/api/connections/accept').set(auth(doc.token)).send({ code: invite.body.code.toLowerCase() });
    expect(accept.status).toBe(200);
    return { patient, doc, connectionId: invite.body.id as string, code: invite.body.code as string };
  }

  it('connects with a one-time code and lets the clinician see only shared sections', async () => {
    const { patient, doc, connectionId, code } = await connect(['symptoms', 'messages']);
    await api().post('/api/symptoms').set(auth(patient.token)).send({ symptomType: 'Bloating', severity: 3 });
    const summary = await api().get(`/api/connections/${connectionId}/summary`).set(auth(doc.token));
    expect(summary.status).toBe(200);
    expect(summary.body.summary.sections).toEqual(['symptoms']);
    expect(summary.body.patient.contact).toBeNull(); // contact not shared
    expect(summary.body.summary.text).toMatch(/Bloating/);

    // Code cannot be reused by another clinician.
    const other = await registerClinician();
    expect((await api().post('/api/connections/accept').set(auth(other.token)).send({ code })).status).toBe(400);
    expect((await api().get(`/api/connections/${connectionId}/summary`).set(auth(other.token))).status).toBe(404);
  });

  it('unverified clinicians cannot connect', async () => {
    const patient = await registerPatient();
    const doc = await registerClinician({ verified: false });
    const invite = await api().post('/api/connections/invite').set(auth(patient.token)).send({ scopes: ['summary'] });
    expect((await api().post('/api/connections/accept').set(auth(doc.token)).send({ code: invite.body.code })).status).toBe(403);
  });

  it('two-way messaging, unread counts and needs-attention flag', async () => {
    const { patient, doc, connectionId } = await connect();
    await api().post(`/api/connections/${connectionId}/messages`).set(auth(patient.token)).send({ body: 'Should I come in?' });
    const list = await api().get('/api/connections').set(auth(doc.token));
    expect(list.body.items[0].unreadCount).toBe(1);
    expect(list.body.items[0].needsAttention).toBe(true);
    const msgs = await api().get(`/api/connections/${connectionId}/messages`).set(auth(doc.token));
    expect(msgs.body.items).toHaveLength(1);
    expect(msgs.body.notice).toMatch(/911/);
    const reply = await api()
      .post(`/api/connections/${connectionId}/messages`)
      .set(auth(doc.token))
      .send({ body: 'Please book a visit this week.', kind: 'appointment_request' });
    expect(reply.status).toBe(201);
    expect((await api().get('/api/connections').set(auth(doc.token))).body.items[0].unreadCount).toBe(0);
  });

  it('patient can narrow scopes or revoke; access stops immediately', async () => {
    const { patient, doc, connectionId } = await connect();
    await api().patch(`/api/connections/${connectionId}`).set(auth(patient.token)).send({ scopes: ['summary'] });
    expect((await api().get(`/api/connections/${connectionId}/messages`).set(auth(doc.token))).status).toBe(403);
    await api().delete(`/api/connections/${connectionId}`).set(auth(patient.token));
    expect((await api().get(`/api/connections/${connectionId}/summary`).set(auth(doc.token))).status).toBe(404);
  });

  it('clinician summary views are audit-logged', async () => {
    const { doc, connectionId } = await connect();
    await api().get(`/api/connections/${connectionId}/summary`).set(auth(doc.token));
    const admin = await makeAdmin();
    const logs = await api().get('/api/admin/audit-logs').set(auth(admin.token));
    expect(logs.body.items.map((l: any) => l.action)).toContain('connection.summary_viewed');
  });
});

describe('API errors', () => {
  it('returns consistent error shapes', async () => {
    const p = await registerPatient();
    const bad = await api().get('/api/symptoms/not-an-id').set(auth(p.token));
    expect(bad.status).toBe(400);
    expect(bad.body.error).toMatchObject({ code: 'BAD_REQUEST' });
    const missing = await api().get('/api/nope');
    expect(missing.status).toBe(404);
    const json = await api().post('/api/auth/login').set('Content-Type', 'application/json').send('{bad json');
    expect(json.status).toBe(400);
  });

  it('does not leak stack traces', async () => {
    const res = await api().post('/api/auth/login').set('Content-Type', 'application/json').send('{bad json');
    expect(JSON.stringify(res.body)).not.toMatch(/at .*\.ts:\d+/);
  });

  it('sets security headers and no-store caching', async () => {
    const res = await api().get('/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});
