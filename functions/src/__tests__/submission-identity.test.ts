import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as functions from 'firebase-functions';
import { startSession, submitAssessment } from '../index';
import { resolveSession } from '../session';
import { bank } from '../data/presift-bank';

/**
 * In-memory fake of the Firestore admin SDK surface used by
 * startSession/submitAssessment. Keyed by `${collection}/${docId}`.
 */
type DocData = Record<string, any>;

const { holder } = vi.hoisted(() => ({ holder: { fs: null as any } }));

vi.mock('firebase-admin', () => ({
  apps: ['mock'],
  initializeApp: vi.fn(),
  firestore: () => holder.fs,
}));

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: { serverTimestamp: () => 'TIMESTAMP', increment: (n: number) => n },
}));

function createFakeFirestore(initial: Record<string, Record<string, DocData>> = {}) {
  const store = new Map<string, DocData>();
  for (const [coll, docs] of Object.entries(initial)) {
    for (const [id, data] of Object.entries(docs)) {
      store.set(`${coll}/${id}`, structuredClone(data));
    }
  }
  const makeRef = (coll: string, id: string) => {
    const key = `${coll}/${id}`;
    return {
      get: async () => ({
        exists: store.has(key),
        data: () => (store.has(key) ? structuredClone(store.get(key)) : undefined),
        ref: { delete: async () => { store.delete(key); } },
      }),
      set: async (data: DocData, opts?: { merge?: boolean }) => {
        if (opts?.merge && store.has(key)) store.set(key, { ...store.get(key), ...data });
        else store.set(key, structuredClone(data));
      },
      update: async (data: DocData) => {
        if (!store.has(key)) throw new Error(`No document to update: ${key}`);
        store.set(key, { ...store.get(key), ...data });
      },
      delete: async () => { store.delete(key); },
    };
  };
  return {
    _store: store,
    collection: (coll: string) => ({ doc: (id: string) => makeRef(coll, id) }),
  };
}

function validPayload(sessionId: string) {
  return {
    sessionId,
    icar: bank.cognitive.items.map((i) => ({ itemId: i.id, selectedIndex: 0 })),
    wleis: bank.wleis.items.map((i) => ({ itemId: i.id, value: 4 })),
  };
}

describe('startSession identity capture', () => {
  beforeEach(() => {
    holder.fs = createFakeFirestore();
  });

  it('stores candidate identity on the session doc when the candidate record exists', async () => {
    const assessmentId = 'assess_cap';
    holder.fs = createFakeFirestore({
      candidates: {
        [assessmentId]: {
          name: 'Prokopios', email: 'p@example.com', appliedRole: 'Senior Consultant',
          recruiterId: 'demo_recruiter', status: 'Invited',
        },
      },
    });

    const res: any = await (startSession as any).run({ assessmentId }, {});
    const sessionDoc = holder.fs._store.get(`sessions/${res.sessionId}`);

    expect(sessionDoc).toBeTruthy();
    expect(sessionDoc.candidateName).toBe('Prokopios');
    expect(sessionDoc.candidateEmail).toBe('p@example.com');
    expect(sessionDoc.appliedRole).toBe('Senior Consultant');
    expect(sessionDoc.candidateRecruiterId).toBe('demo_recruiter');
    // keys never leak to the client payload
    expect(res.keys).toBeUndefined();
  });

  it('starts the session with empty identity when the candidate record does not exist', async () => {
    const res: any = await (startSession as any).run({ assessmentId: 'assess_ghost' }, {});
    const sessionDoc = holder.fs._store.get(`sessions/${res.sessionId}`);

    expect(sessionDoc).toBeTruthy();
    expect(sessionDoc.candidateName).toBe('');
    expect(sessionDoc.candidateRecruiterId).toBe('');
  });
});

describe('submitAssessment orphan handling', () => {
  beforeEach(() => {
    holder.fs = createFakeFirestore();
  });

  it('reconstructs a NAMED result doc (with recruiterId) when the candidate doc is missing but identity was captured', async () => {
    const assessmentId = 'assess_orphan';
    const session = resolveSession(assessmentId, bank);
    holder.fs = createFakeFirestore({
      sessions: {
        [session.sessionId]: {
          keys: session.keys, assessmentId, sessionToken: 'tok', answers: [], integrityEvents: [],
          recruiterId: 'demo_recruiter',
          candidateName: 'Prokopios', candidateEmail: 'p@example.com',
          appliedRole: 'Senior Consultant', candidateRecruiterId: 'demo_recruiter',
        },
      },
    });

    const res: any = await (submitAssessment as any).run(validPayload(session.sessionId), {});
    expect(res.success).toBe(true);

    const resultDoc = holder.fs._store.get(`candidates/${assessmentId}`);
    expect(resultDoc).toBeTruthy();
    expect(resultDoc.name).toBe('Prokopios');
    expect(resultDoc.email).toBe('p@example.com');
    expect(resultDoc.appliedRole).toBe('Senior Consultant');
    expect(resultDoc.recruiterId).toBe('demo_recruiter');
    expect(resultDoc.status).toBe('Completed');
    expect(resultDoc.scoreResult).toBeTruthy();
    expect(resultDoc.completionDate).toBeTruthy();

    // session consumed after submission
    expect(holder.fs._store.has(`sessions/${session.sessionId}`)).toBe(false);
  });

  it('FAILS LOUDLY instead of writing an anonymous orphan when there is no identity to attach', async () => {
    const assessmentId = 'assess_invalid';
    const session = resolveSession(assessmentId, bank);
    holder.fs = createFakeFirestore({
      sessions: {
        [session.sessionId]: {
          keys: session.keys, assessmentId, sessionToken: 'tok', answers: [], integrityEvents: [],
        },
      },
    });

    const err: any = await (submitAssessment as any).run(validPayload(session.sessionId), {}).catch((e: any) => e);

    expect(err).toBeInstanceOf(functions.https.HttpsError);
    expect(err.code).toBe('failed-precondition');
    expect(String(err.message)).toMatch(/invalid/i);

    // no candidate doc of any kind was created
    const candidateKeys = [...holder.fs._store.keys()].filter((k) => k.startsWith('candidates/'));
    expect(candidateKeys).toHaveLength(0);
  });

  it('merges results into the existing candidate doc on the normal path (no orphan)', async () => {
    const assessmentId = 'assess_merge';
    const session = resolveSession(assessmentId, bank);
    holder.fs = createFakeFirestore({
      sessions: {
        [session.sessionId]: {
          keys: session.keys, assessmentId, sessionToken: 'tok', answers: [], integrityEvents: [],
          candidateName: 'Alice', candidateRecruiterId: 'demo_recruiter',
        },
      },
      candidates: {
        [assessmentId]: { name: 'Alice', appliedRole: 'Engineer', status: 'Invited', recruiterId: 'demo_recruiter' },
      },
    });

    const res: any = await (submitAssessment as any).run(validPayload(session.sessionId), {});
    expect(res.success).toBe(true);

    const doc = holder.fs._store.get(`candidates/${assessmentId}`);
    expect(doc.status).toBe('Completed');
    expect(doc.name).toBe('Alice'); // existing identity preserved
    expect(doc.scoreResult).toBeTruthy();

    // no duplicate orphan doc
    expect(holder.fs._store.has(`candidates/cand_${session.sessionId}`)).toBe(false);
  });
});
