/**
 * Tests for registerRecruiter callable.
 * Covers:
 * - New user registration (created: true, credits: 0, default counters, server timestamps)
 * - Existing user registration / merge (created: false, preserves credits and existing counters)
 * - Validation errors (missing/empty name, invalid/missing email, missing companyName, invalid uid)
 * - Demo mode / auth checks
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  getMock,
  setMock,
  updateMock,
  collectionMock,
  docMock,
} = vi.hoisted(() => {
  const setMock = vi.fn().mockResolvedValue(undefined);
  const updateMock = vi.fn().mockResolvedValue(undefined);
  const deleteMock = vi.fn();
  const getMock = vi.fn();
  const docMock = vi.fn(() => ({ get: getMock, set: setMock, update: updateMock, delete: deleteMock }));
  const collectionMock = vi.fn(() => ({ doc: docMock }));

  return { getMock, setMock, updateMock, collectionMock, docMock };
});

vi.mock('firebase-admin', () => {
  const firestoreMock = () => ({
    collection: collectionMock,
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
    config: () => ({ demo: { allow_anon: 'true' } }),
  };
});

import { registerRecruiter } from '../index';

const AUTH_CTX = { auth: { uid: 'auth_recruiter_123' } } as any;
const ANON_CTX = { auth: undefined } as any;

describe('registerRecruiter callable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setMock.mockResolvedValue(undefined);
  });

  it('creates new recruiter profile with 0 credits and timestamps when user doc does not exist', async () => {
    // Arrange
    getMock.mockResolvedValueOnce({ exists: false });
    const payload = {
      uid: 'new_recruiter_1',
      name: 'Jane Recruiter',
      email: 'jane@company.com',
      companyName: 'Tech Hires Inc',
      vatId: 'DE987654321',
      billingAddress: 'Main St 10, Berlin',
    };

    // Act
    const res = await registerRecruiter(payload, AUTH_CTX);

    // Assert
    expect(res).toEqual({
      uid: 'new_recruiter_1',
      created: true,
      profile: {
        uid: 'new_recruiter_1',
        name: 'Jane Recruiter',
        email: 'jane@company.com',
        companyName: 'Tech Hires Inc',
        vatId: 'DE987654321',
        billingAddress: 'Main St 10, Berlin',
        credits: 0,
        totalSpent: 0,
        totalPurchased: 0,
        role: 'recruiter',
      },
    });
    expect(setMock).toHaveBeenCalledWith({
      name: 'Jane Recruiter',
      email: 'jane@company.com',
      companyName: 'Tech Hires Inc',
      vatId: 'DE987654321',
      billingAddress: 'Main St 10, Berlin',
      role: 'recruiter',
      credits: 0,
      totalSpent: 0,
      totalPurchased: 0,
      createdAt: '__SERVER_TIMESTAMP__',
      updatedAt: '__SERVER_TIMESTAMP__',
    });
  });

  it('merges profile and preserves credits/counters when user doc already exists (idempotent)', async () => {
    // Arrange
    const existingUserData = {
      name: 'Old Name',
      email: 'old@company.com',
      companyName: 'Old Corp',
      credits: 15,
      totalSpent: 75,
      totalPurchased: 15,
      role: 'recruiter',
    };
    getMock.mockResolvedValueOnce({
      exists: true,
      data: () => existingUserData,
    });
    const payload = {
      uid: 'existing_recruiter_1',
      name: 'Updated Name',
      email: 'updated@company.com',
      companyName: 'Updated Corp',
      vatId: 'FR123456789',
    };

    // Act
    const res = await registerRecruiter(payload, AUTH_CTX);

    // Assert
    expect(res).toEqual({
      uid: 'existing_recruiter_1',
      created: false,
      profile: {
        uid: 'existing_recruiter_1',
        name: 'Updated Name',
        email: 'updated@company.com',
        companyName: 'Updated Corp',
        vatId: 'FR123456789',
        billingAddress: '',
        credits: 15,
        totalSpent: 75,
        totalPurchased: 15,
        role: 'recruiter',
      },
    });
    expect(setMock).toHaveBeenCalledWith(
      {
        name: 'Updated Name',
        email: 'updated@company.com',
        companyName: 'Updated Corp',
        vatId: 'FR123456789',
        billingAddress: '',
        updatedAt: '__SERVER_TIMESTAMP__',
      },
      { merge: true }
    );
    // Credits must NOT be in the set payload
    expect(setMock.mock.calls[0][0]).not.toHaveProperty('credits');
    expect(setMock.mock.calls[0][0]).not.toHaveProperty('totalSpent');
    expect(setMock.mock.calls[0][0]).not.toHaveProperty('totalPurchased');
  });

  it('generates a new uid if uid is omitted and no auth uid is present', async () => {
    // Arrange
    getMock.mockResolvedValueOnce({ exists: false });
    const payload = {
      name: 'Anonymous Recruiter',
      email: 'anon@recruit.com',
      companyName: 'Anon Recruiting',
    };

    // Act
    const res = await registerRecruiter(payload, ANON_CTX);

    // Assert
    expect(res.created).toBe(true);
    expect(typeof res.uid).toBe('string');
    expect(res.uid.length).toBeGreaterThan(0);
    expect(res.profile.email).toBe('anon@recruit.com');
  });

  it('rejects missing or empty full name with invalid-argument', async () => {
    // Arrange
    const payload = {
      name: '   ',
      email: 'recruiter@company.com',
      companyName: 'Company Inc',
    };

    // Act & Assert
    await expect(registerRecruiter(payload, AUTH_CTX)).rejects.toMatchObject({
      code: 'invalid-argument',
    });
  });

  it('rejects missing or malformed email with invalid-argument', async () => {
    // Arrange
    const payloadMissing = {
      name: 'John Doe',
      email: '',
      companyName: 'Company Inc',
    };
    const payloadInvalid = {
      name: 'John Doe',
      email: 'not-an-email',
      companyName: 'Company Inc',
    };

    // Act & Assert
    await expect(registerRecruiter(payloadMissing, AUTH_CTX)).rejects.toMatchObject({
      code: 'invalid-argument',
    });
    await expect(registerRecruiter(payloadInvalid, AUTH_CTX)).rejects.toMatchObject({
      code: 'invalid-argument',
    });
  });

  it('rejects missing or empty company name with invalid-argument', async () => {
    // Arrange
    const payload = {
      name: 'John Doe',
      email: 'john@company.com',
      companyName: '',
    };

    // Act & Assert
    await expect(registerRecruiter(payload, AUTH_CTX)).rejects.toMatchObject({
      code: 'invalid-argument',
    });
  });

  it('rejects invalid uid type or empty string with invalid-argument', async () => {
    // Arrange
    const payload = {
      uid: '   ',
      name: 'John Doe',
      email: 'john@company.com',
      companyName: 'Company Inc',
    };

    // Act & Assert
    await expect(registerRecruiter(payload, ANON_CTX)).rejects.toMatchObject({
      code: 'invalid-argument',
    });
  });
});
