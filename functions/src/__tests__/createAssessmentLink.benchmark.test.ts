import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as functions from 'firebase-functions';

const {
  getMock,
  setMock,
  updateMock,
  addMock,
  getUserMock,
  docMock,
  collectionMock,
  sendMailTransportMock,
} = vi.hoisted(() => {
  const getMock = vi.fn();
  const setMock = vi.fn().mockResolvedValue(undefined);
  const updateMock = vi.fn().mockResolvedValue(undefined);
  const addMock = vi.fn().mockResolvedValue({ id: 'log_1' });
  const getUserMock = vi.fn();
  const docMock = vi.fn((id?: string) => ({
    id: id || 'cand_generated_123',
    get: getMock,
    set: setMock,
    update: updateMock,
  }));
  const collectionMock = vi.fn(() => ({
    doc: docMock,
    add: addMock,
    where: vi.fn().mockReturnThis(),
    count: vi.fn(() => ({ get: vi.fn().mockResolvedValue({ data: () => ({ count: 0 }) }) })),
  }));
  const sendMailTransportMock = vi.fn().mockResolvedValue({ messageId: '<msg-1>' });

  return {
    getMock,
    setMock,
    updateMock,
    addMock,
    getUserMock,
    docMock,
    collectionMock,
    sendMailTransportMock,
  };
});

vi.mock('nodemailer', () => ({
  createTransport: vi.fn(() => ({
    sendMail: sendMailTransportMock,
  })),
}));

vi.mock('firebase-admin', () => {
  const firestoreMock = () => ({
    collection: collectionMock,
  });

  return {
    apps: ['mock'],
    initializeApp: vi.fn(),
    firestore: Object.assign(firestoreMock, {
      FieldValue: {
        serverTimestamp: () => '__SERVER_TIMESTAMP__',
        increment: (n: number) => `__INCREMENT_${n}__`,
      },
    }),
    auth: () => ({
      getUser: getUserMock,
    }),
  };
});

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: {
    serverTimestamp: () => '__SERVER_TIMESTAMP__',
    increment: (n: number) => `__INCREMENT_${n}__`,
  },
}));

vi.mock('firebase-functions', () => {
  class HttpsError extends Error {
    public code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  }
  return {
    https: {
      onCall: (handler: any) => handler,
      onRequest: (handler: any) => handler,
      HttpsError,
    },
    pubsub: {
      schedule: () => ({ onRun: (handler: any) => handler }),
    },
    config: () => ({ demo: { allow_anon: 'false' } }),
  };
});

import { createAssessmentLink, updateCandidate, updateCandidateStatus } from '../index';
import { buildInvite, buildBenchmarkInvite, sendCandidateInvite } from '../mailer';

function makeContext(
  uid: string | undefined,
  admin: boolean
): functions.https.CallableContext {
  return {
    auth: uid
      ? { uid, token: { admin } as any }
      : undefined,
    rawRequest: {} as any,
  } as unknown as functions.https.CallableContext;
}

describe('createAssessmentLink & benchmark support', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMock.mockReset();
    setMock.mockReset();
    updateMock.mockReset();
    addMock.mockReset();
    getUserMock.mockReset();
    getUserMock.mockResolvedValue({ customClaims: {} });
    setMock.mockResolvedValue(undefined);
    updateMock.mockResolvedValue(undefined);
    addMock.mockResolvedValue({ id: 'log_1' });
    sendMailTransportMock.mockResolvedValue({ messageId: '<msg-1>' });

    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_USER = 'user@example.com';
    process.env.SMTP_PASS = 'secret';
    process.env.SMTP_FROM = 'no-reply@example.com';
    delete process.env.PILOT_DAILY_CAP;
  });

  it('preserves hire default behaviour when purpose is omitted or "hire"', async () => {
    // Arrange
    const ctx = makeContext('recruiter_1', false);
    getMock.mockResolvedValueOnce({
      exists: true,
      data: () => ({ credits: 5, companyName: 'Acme Corp' }),
    });

    // Act
    const res = await createAssessmentLink(
      { roleTitle: 'Engineer', candidateName: 'Maria', candidateEmail: '' },
      ctx
    );

    // Assert
    expect(res).toEqual({
      url: 'http://localhost:5173/assessment/cand_generated_123',
      candidateId: 'cand_generated_123',
      emailStatus: 'no-email',
    });
    expect(updateMock).toHaveBeenCalledWith({ credits: '__INCREMENT_-1__' });
    expect(setMock).toHaveBeenCalledWith({
      appliedRole: 'Engineer',
      name: 'Maria',
      email: '',
      status: 'Invited',
      lang: 'el',
      createdAt: '__SERVER_TIMESTAMP__',
      recruiterId: 'recruiter_1',
      clientIds: ['recruiter_1'],
    });
  });

  it('rejects invalid purpose values with invalid-argument', async () => {
    // Arrange
    const ctx = makeContext('recruiter_1', false);

    // Act
    const act = createAssessmentLink(
      { roleTitle: 'Engineer', purpose: 'other' },
      ctx
    );

    // Assert
    await expect(act).rejects.toMatchObject({ code: 'invalid-argument' });
    expect(setMock).not.toHaveBeenCalled();
  });

  it('rejects benchmark links with missing, non-integer, or out-of-range performanceRating', async () => {
    // Arrange
    const ctx = makeContext('recruiter_1', false);

    // Act & Assert
    await expect(
      createAssessmentLink({ roleTitle: 'Engineer', purpose: 'benchmark' }, ctx)
    ).rejects.toMatchObject({ code: 'invalid-argument' });
    await expect(
      createAssessmentLink({ roleTitle: 'Engineer', purpose: 'benchmark', performanceRating: 0 }, ctx)
    ).rejects.toMatchObject({ code: 'invalid-argument' });
    await expect(
      createAssessmentLink({ roleTitle: 'Engineer', purpose: 'benchmark', performanceRating: 11 }, ctx)
    ).rejects.toMatchObject({ code: 'invalid-argument' });
    await expect(
      createAssessmentLink({ roleTitle: 'Engineer', purpose: 'benchmark', performanceRating: 5.5 }, ctx)
    ).rejects.toMatchObject({ code: 'invalid-argument' });
    await expect(
      createAssessmentLink({ roleTitle: 'Engineer', purpose: 'benchmark', performanceRating: '7' as any }, ctx)
    ).rejects.toMatchObject({ code: 'invalid-argument' });
    await expect(
      createAssessmentLink({ roleTitle: 'Engineer', purpose: 'benchmark', performanceRating: null as any }, ctx)
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('creates a benchmark candidate document with caller raterUid and sends benchmark invite', async () => {
    // Arrange
    const adminCtx = makeContext('admin_caller_99', true);
    getMock.mockResolvedValueOnce({
      exists: true,
      data: () => ({ credits: 3, companyName: 'Olympus SA' }),
    });

    // Act
    const res = await createAssessmentLink(
      {
        roleTitle: 'Account Executive',
        candidateName: 'Nikos',
        candidateEmail: 'nikos@olympus.gr',
        recruiterId: 'recruiter_target_1',
        purpose: 'benchmark',
        performanceRating: 8,
        lang: 'el',
      },
      adminCtx
    );

    // Assert
    expect(res.emailStatus).toBe('sent');
    expect(setMock).toHaveBeenCalledWith({
      appliedRole: 'Account Executive',
      name: 'Nikos',
      email: 'nikos@olympus.gr',
      status: 'Invited',
      lang: 'el',
      createdAt: '__SERVER_TIMESTAMP__',
      recruiterId: 'recruiter_target_1',
      clientIds: ['recruiter_target_1'],
      purpose: 'benchmark',
      performanceRating: 8,
      ratingScale: '1-10',
      ratedAt: '__SERVER_TIMESTAMP__',
      raterUid: 'admin_caller_99',
    });
    expect(addMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'nikos@olympus.gr',
        kind: 'invite',
        purpose: 'benchmark',
        status: 'sent',
      })
    );
  });

  it('preserves notify:false opt-out and no-email return statuses for benchmark links', async () => {
    // Arrange
    const ctx = makeContext('recruiter_1', false);
    getMock.mockResolvedValue({
      exists: true,
      data: () => ({ credits: 5, companyName: 'Olympus SA' }),
    });

    // Act
    const resNotRequested = await createAssessmentLink(
      {
        roleTitle: 'Ops',
        candidateName: 'Anna',
        candidateEmail: 'anna@olympus.gr',
        notify: false,
        purpose: 'benchmark',
        performanceRating: 10,
      },
      ctx
    );
    const resNoEmail = await createAssessmentLink(
      {
        roleTitle: 'Ops',
        candidateName: 'Anna',
        candidateEmail: '',
        purpose: 'benchmark',
        performanceRating: 1,
      },
      ctx
    );

    // Assert
    expect(resNotRequested.emailStatus).toBe('not-requested');
    expect(resNoEmail.emailStatus).toBe('no-email');
    expect(sendMailTransportMock).not.toHaveBeenCalled();
  });

  it('locks rating fields in updateCandidate and updateCandidateStatus', async () => {
    // Arrange
    const ctx = makeContext('recruiter_1', false);

    // Act & Assert
    for (const lockedKey of ['performanceRating', 'purpose', 'ratingScale', 'ratedAt', 'raterUid']) {
      await expect(
        updateCandidate({ candidateId: 'c1', name: 'New Name', [lockedKey]: 'tamper' }, ctx)
      ).rejects.toMatchObject({ code: 'invalid-argument' });
      await expect(
        updateCandidateStatus({ candidateId: 'c1', status: 'Shortlisted', [lockedKey]: 'tamper' }, ctx)
      ).rejects.toMatchObject({ code: 'invalid-argument' });
    }
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('builds benchmark invite with company sender, neutral fallback greeting, and GDPR deletion footer', async () => {
    // Arrange & Act
    const el = buildBenchmarkInvite({
      to: 'emp@acme.gr',
      candidateName: '',
      roleTitle: 'Analyst',
      company: 'Acme Hellas',
      url: 'https://presift.web.app/assessment/c1',
      lang: 'el',
    });
    const en = buildBenchmarkInvite({
      to: 'emp@acme.gr',
      candidateName: '',
      roleTitle: 'Analyst',
      company: 'Acme Hellas',
      url: 'https://presift.web.app/assessment/c1',
      lang: 'en',
    });
    const hire = buildInvite({
      to: 'cand@acme.gr',
      candidateName: '',
      roleTitle: 'Analyst',
      company: 'Acme Hellas',
      url: 'https://presift.web.app/assessment/c1',
      lang: 'en',
    });

    // Assert
    expect(el.text).toContain('Αγαπητέ/ή συνάδελφε,');
    expect(el.text).toContain('Acme Hellas');
    expect(el.text).not.toContain('η ομάδα σου');
    expect(el.text).toContain('Για διαγραφή των δεδομένων σας, απαντήστε σε αυτό το μήνυμα.');
    expect(en.text).toContain('Dear colleague,');
    expect(en.text).toContain('Acme Hellas');
    expect(en.text).toContain('not a job application');
    expect(en.text).toContain('To have your data deleted, reply to this message.');
    expect(hire.text).toContain('Dear candidate,');
    expect(hire.text).toContain('The PreSift team');

    await sendCandidateInvite({
      to: 'cand@acme.gr',
      roleTitle: 'Analyst',
      company: 'Acme Hellas',
      url: 'https://presift.web.app/assessment/c1',
    });
    expect(addMock).toHaveBeenCalledWith(expect.objectContaining({ purpose: 'hire' }));
  });
});
