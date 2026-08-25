import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const {
  getMock,
  setMock,
  updateMock,
  deleteMock,
  collectionMock,
  docMock,
} = vi.hoisted(() => {
  const setMock = vi.fn().mockResolvedValue(undefined);
  const updateMock = vi.fn().mockResolvedValue(undefined);
  const deleteMock = vi.fn().mockResolvedValue(undefined);
  const getMock = vi.fn();
  const docMock = vi.fn(() => ({ get: getMock, set: setMock, update: updateMock, delete: deleteMock, id: 'test_doc_id' }));
  const collectionMock = vi.fn(() => ({ doc: docMock }));

  return { getMock, setMock, updateMock, deleteMock, collectionMock, docMock };
});

vi.mock('firebase-admin', () => {
  const firestoreMock = () => ({
    collection: collectionMock,
    batch: () => ({ update: vi.fn(), commit: vi.fn() }),
    getAll: vi.fn(),
  });

  return {
    apps: ['mock'],
    initializeApp: vi.fn(),
    firestore: Object.assign(firestoreMock, {}),
  };
});

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: {
    serverTimestamp: () => '__SERVER_TIMESTAMP__',
    delete: () => '__DELETE__',
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

import { createCampaign } from '../index';

describe('createCampaign', () => {
  let originalEmulatorEnv: string | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    originalEmulatorEnv = process.env.FUNCTIONS_EMULATOR;
    process.env.FUNCTIONS_EMULATOR = 'false';
    getMock.mockResolvedValue({
      exists: true,
      data: () => ({ role: 'recruiter' })
    });
  });

  afterEach(() => {
    process.env.FUNCTIONS_EMULATOR = originalEmulatorEnv;
    vi.restoreAllMocks();
  });

  it('rejects unauthenticated calls (when demo bypass is off)', async () => {
    await expect(
      (createCampaign as any)({ positionTitle: 'Engineer', moduleIds: ['icar16'], recruiterId: 'u1' }, { auth: undefined })
    ).rejects.toMatchObject({ message: 'Must be logged in' });
  });

  it('rejects missing or invalid positionTitle', async () => {
    await expect(
      (createCampaign as any)({ moduleIds: ['icar16'], recruiterId: 'u1' }, { auth: { uid: 'u1' } })
    ).rejects.toMatchObject({ message: 'Missing positionTitle' });
    
    await expect(
      (createCampaign as any)({ positionTitle: '  ', moduleIds: ['icar16'], recruiterId: 'u1' }, { auth: { uid: 'u1' } })
    ).rejects.toMatchObject({ message: 'Missing positionTitle' });
  });

  it('rejects missing or empty moduleIds', async () => {
    await expect(
      (createCampaign as any)({ positionTitle: 'Engineer', recruiterId: 'u1' }, { auth: { uid: 'u1' } })
    ).rejects.toMatchObject({ message: 'moduleIds must be a non-empty array' });
    
    await expect(
      (createCampaign as any)({ positionTitle: 'Engineer', moduleIds: [], recruiterId: 'u1' }, { auth: { uid: 'u1' } })
    ).rejects.toMatchObject({ message: 'moduleIds must be a non-empty array' });
  });

  it('rejects invalid moduleIds', async () => {
    await expect(
      (createCampaign as any)({ positionTitle: 'Engineer', moduleIds: ['icar16', 'invalid_mod'], recruiterId: 'u1' }, { auth: { uid: 'u1' } })
    ).rejects.toMatchObject({ message: 'invalid moduleId: invalid_mod' });
  });

  it('creates a campaign with valid inputs', async () => {
    const res = await (createCampaign as any)({
      positionTitle: ' Senior Engineer ',
      department: ' Engineering ',
      moduleIds: ['icar16', 'wleis16'],
      recruiterId: 'u1'
    }, { auth: { uid: 'u1' } });

    expect(res.id).toBe('test_doc_id');

    expect(setMock).toHaveBeenCalledWith({
      id: 'test_doc_id',
      recruiterId: 'u1',
      positionTitle: 'Senior Engineer',
      department: 'Engineering',
      moduleIds: ['icar16', 'wleis16'],
      status: 'open',
      createdAt: '__SERVER_TIMESTAMP__',
      candidateCount: 0
    });
  });

  it('allows anonymous call when demo bypass is on', async () => {
    process.env.FUNCTIONS_EMULATOR = 'true';

    const res = await (createCampaign as any)({
      positionTitle: 'Demo Position',
      moduleIds: ['icar16'],
      recruiterId: 'demo_recruiter'
    }, { auth: undefined });

    expect(res.id).toBe('test_doc_id');
    expect(setMock).toHaveBeenCalledWith(expect.objectContaining({
      recruiterId: 'demo_recruiter'
    }));
  });
});
