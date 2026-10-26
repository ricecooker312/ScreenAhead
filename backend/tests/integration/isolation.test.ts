import { api, startDb, stopDb, clearDb, registerPatient, registerClinician, makeAdmin, auth, PASSWORD } from './setup';
import { SAFE_URGENT } from '../helpers/answers';
import {
  HealthProfileModel,
  SymptomEntryModel,
  QuestionnaireModel,
  TriageResultModel,
  AppointmentModel,
  AuditLogModel,
  UserModel,
} from '../../src/models';

beforeAll(startDb);
afterAll(stopDb);
afterEach(clearDb);

describe('cross-user data isolation', () => {
  it('a user cannot read, change or delete another user’s symptom entries by changing the id', async () => {
    const alice = await registerPatient();
    const bob = await registerPatient();
    const created = await api().post('/api/symptoms').set(auth(alice.token)).send({ symptomType: 'Belly pain', severity: 4 });
    const id = created.body.entry._id;

    expect((await api().get(`/api/symptoms/${id}`).set(auth(bob.token))).status).toBe(404);
    expect((await api().patch(`/api/symptoms/${id}`).set(auth(bob.token)).send({ severity: 9 })).status).toBe(404);
    expect((await api().delete(`/api/symptoms/${id}`).set(auth(bob.token))).status).toBe(404);
    expect((await api().get('/api/symptoms').set(auth(bob.token))).body.items).toHaveLength(0);

    const still = await api().get(`/api/symptoms/${id}`).set(auth(alice.token));
    expect(still.body.severity).toBe(4);
  });

  it('questionnaires and appointments are isolated', async () => {
    const alice = await registerPatient();
    const bob = await registerPatient();
    const q = await api().post('/api/questionnaires').set(auth(alice.token));
    const qid = q.body.questionnaire._id;
    expect((await api().get(`/api/questionnaires/${qid}`).set(auth(bob.token))).status).toBe(404);
    expect((await api().patch(`/api/questionnaires/${qid}`).set(auth(bob.token)).send({ answers: { breathing: 'normal' } })).status).toBe(404);
    expect((await api().post(`/api/questionnaires/${qid}/submit`).set(auth(bob.token))).status).toBe(404);

    const a = await api().post('/api/appointments').set(auth(alice.token)).send({ title: 'GI visit', startsAt: new Date(Date.now() + 86400000).toISOString() });
    expect((await api().patch(`/api/appointments/${a.body._id}`).set(auth(bob.token)).send({ title: 'x' })).status).toBe(404);
    expect((await api().delete(`/api/appointments/${a.body._id}`).set(auth(bob.token))).status).toBe(404);
  });

  it('the user id in the body cannot be used to write into another account', async () => {
    const alice = await registerPatient();
    const bob = await registerPatient();
    const res = await api().post('/api/symptoms').set(auth(bob.token)).send({ symptomType: 'Tired', user: alice.user._id });
    expect(res.status).toBe(400); // unknown field rejected by strict schema
    const profile = await api().put('/api/health-profile').set(auth(bob.token)).send({ age: 40, user: alice.user._id });
    expect(profile.status).toBe(400);
  });

  it('rejects MongoDB operator injection', async () => {
    const alice = await registerPatient();
    const res = await api().post('/api/auth/login').send({ email: { $ne: null }, password: { $ne: null } });
    expect(res.status).toBe(400);
    // Express 5's simple query parser never builds nested objects, so operators arrive as plain keys and are ignored.
    await api().post('/api/symptoms').set(auth(alice.token)).send({ symptomType: 'Tired' });
    const q = await api().get('/api/symptoms').query('type[$ne]=x').set(auth(alice.token));
    expect(q.status).toBe(200);
    expect(q.body.items).toHaveLength(1);
  });

  it('clinicians and admins cannot use patient-only endpoints', async () => {
    const doc = await registerClinician();
    const admin = await makeAdmin();
    for (const t of [doc.token, admin.token]) {
      expect((await api().get('/api/health-profile').set(auth(t))).status).toBe(403);
      expect((await api().get('/api/symptoms').set(auth(t))).status).toBe(403);
    }
  });

  it('patients cannot use admin endpoints', async () => {
    const p = await registerPatient();
    expect((await api().get('/api/admin/audit-logs').set(auth(p.token))).status).toBe(403);
    expect((await api().post('/api/admin/providers').set(auth(p.token)).send({ name: 'x', specialties: ['primary_care'] })).status).toBe(403);
  });
});

describe('account and data deletion', () => {
  it('deletes all of the user’s health data after password confirmation', async () => {
    const p = await registerPatient();
    await api().put('/api/health-profile').set(auth(p.token)).send({ age: 50, allergies: [{ substance: 'Penicillin' }] });
    await api().post('/api/symptoms').set(auth(p.token)).send({ symptomType: 'Bloating', severity: 3 });
    await api().post('/api/appointments').set(auth(p.token)).send({ title: 'Check-up', startsAt: new Date(Date.now() + 86400000).toISOString() });
    const q = await api().post('/api/questionnaires').set(auth(p.token));
    await api()
      .patch(`/api/questionnaires/${q.body.questionnaire._id}`)
      .set(auth(p.token))
      .send({ answers: { ...SAFE_URGENT, symptoms: ['none'], desired_help: ['screening_info'] } });
    await api().post(`/api/questionnaires/${q.body.questionnaire._id}/submit`).set(auth(p.token));

    expect((await api().delete('/api/users/me').set(auth(p.token)).send({ password: 'wrong-password1' })).status).toBe(401);
    expect((await api().delete('/api/users/me').set(auth(p.token)).send({ password: PASSWORD })).status).toBe(204);

    const uid = p.user._id;
    expect(await UserModel.exists({ _id: uid })).toBeNull();
    for (const M of [HealthProfileModel, SymptomEntryModel, QuestionnaireModel, TriageResultModel, AppointmentModel] as any[]) {
      expect(await M.countDocuments({ user: uid })).toBe(0);
    }
    expect((await api().get('/api/users/me').set(auth(p.token))).status).toBe(401);
    // Audit trail records the deletion without health details.
    const log = await AuditLogModel.findOne({ action: 'user.account_deleted' }).lean();
    expect(log).not.toBeNull();
    expect(JSON.stringify(log)).not.toMatch(/Penicillin|Bloating/);
  });

  it('exports the user’s own data without secrets', async () => {
    const p = await registerPatient();
    await api().post('/api/symptoms').set(auth(p.token)).send({ symptomType: 'Tired', severity: 2 });
    const res = await api().get('/api/users/me/export').set(auth(p.token));
    expect(res.status).toBe(200);
    expect(res.body.symptoms).toHaveLength(1);
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|argon2/);
  });
});
