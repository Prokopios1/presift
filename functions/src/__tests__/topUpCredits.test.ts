import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as functions from 'firebase-functions';

const { getMock, setMock, getUserMock, docMock, collectionMock } = vi.hoisted(() => {
  const getMock = vi.fn();
  const setMock = vi.fn().mockResolvedValue(undefined);
  const getUserMock = vi.fn();
  const docMock = vi.fn(() => ({ get: getMock, set: setMock }));
  const collectionMock = vi.fn(() => ({ doc: docMock }));

  return { getMock, setMock, getUserMock, docMock, collectionMock };
});

vi.mock('firebase-admin', () => {
  const firestoreMock = () => ({
    collection: collectionMock,
  });

  return {
    apps: ['mock'],
    initializeApp: vi.fn(),
    firestore: Object.assign(firestoreMock, {}),
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

import { topUpCredits } from '../index';

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

describe('topUpCredits callable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMock.mockReset();
    setMock.mockReset();
    getUserMock.mockReset();
    getUserMock.mockResolvedValue({ customClaims: {} });
    setMock.mockResolvedValue(undefined);
  });

  it('rejects a non-admin caller with permission-denied', async () => {
    // Arrange
    const nonAdminContext = makeContext('recruiter_user_1', false);
    const data = { amount: 10, recruiterId: 'recruiter_user_1' };

    // Act
    const act = topUpCredits(data, nonAdminContext);

    // Assert
    await expect(act).rejects.toMatchObject({
      code: 'permission-denied',
      message: 'Only admins can top up credits',
    });
    expect(setMock).not.toHaveBeenCalled();
  });

  it('allows a claim-admin caller and tops up recruiter credits', async () => {
    // Arrange
    const adminContext = makeContext('admin_user_1', true);
    const data = { amount: 25, recruiterId: 'target_recruiter_123' };
    getMock.mockResolvedValueOnce({ exists: true, data: () => ({ credits: 10 }) });

    // Act
    const result = await topUpCredits(data, adminContext);

    // Assert
    expect(result).toEqual({ success: true });
    expect(docMock).toHaveBeenCalledWith('target_recruiter_123');
    expect(setMock).toHaveBeenCalledWith(
      { credits: '__INCREMENT_25__' },
      { merge: true }
    );
  });

  it('rejects invalid, negative, non-numeric, or null amounts', async () => {
    // Arrange
    const adminContext = makeContext('admin_user_1', true);

    // Act & Assert
    await expect(topUpCredits({ amount: 0, recruiterId: 'r1' }, adminContext)).rejects.toMatchObject({ code: 'invalid-argument' });
    await expect(topUpCredits({ amount: -5, recruiterId: 'r1' }, adminContext)).rejects.toMatchObject({ code: 'invalid-argument' });
    await expect(topUpCredits({ amount: null, recruiterId: 'r1' } as any, adminContext)).rejects.toMatchObject({ code: 'invalid-argument' });
    await expect(topUpCredits({ amount: 'ten', recruiterId: 'r1' } as any, adminContext)).rejects.toMatchObject({ code: 'invalid-argument' });
    await expect(topUpCredits(undefined as any, adminContext)).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('rejects topping up credits for another admin account directly', async () => {
    // Arrange
    const adminContext = makeContext('admin_user_1', true);
    const data = { amount: 10, recruiterId: 'another_admin_user' };
    getUserMock.mockResolvedValue({ customClaims: { admin: true } });

    // Act
    const act = topUpCredits(data, adminContext);

    // Assert
    await expect(act).rejects.toMatchObject({
      code: 'permission-denied',
    });
    expect(setMock).not.toHaveBeenCalled();
  });

  it('rejects when target recruiter does not exist', async () => {
    // Arrange
    const adminContext = makeContext('admin_user_1', true);
    const data = { amount: 10, recruiterId: 'ghost_recruiter' };
    getMock.mockResolvedValueOnce({ exists: false });

    // Act
    const act = topUpCredits(data, adminContext);

    // Assert
    await expect(act).rejects.toMatchObject({
      code: 'not-found',
      message: 'Recruiter not found',
    });
    expect(setMock).not.toHaveBeenCalled();
  });
});
