/**
 * Tests for registerRecruiter callable.
 * Covers:
 * - New user registration (created: true, credits: 0, default counters, server timestamps)
 * - Existing user registration / merge (created: false, preserves credits and existing counters)
 * - Adoption of existing admin-created doc by email
 * - Validation errors (missing/empty name, invalid/missing email, missing companyName, invalid uid)
 * - Demo mode / auth checks
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  getMock,
  setMock,
  updateMock,
  deleteMock,
  collectionMock,
  docMock,
  whereMock,
  whereGetMock,
  batchCommitMock,
  batchSetMock,
  batchDeleteMock
} = vi.hoisted(() => {
  const setMock = vi.fn().mockResolvedValue(undefined);
  const updateMock = vi.fn().mockResolvedValue(undefined);
  const deleteMock = vi.fn();
  const getMock = vi.fn();
  
  const whereGetMock = vi.fn().mockResolvedValue({ empty: true, docs: [] });
  const whereMock = vi.fn(() => ({ get: whereGetMock }));
  
  // Need to hoist collectionMock but it calls docMock and vice versa. 
  // Let's define them in a way they can reference each other.
  const collectionMockFn = vi.fn();
  const docMockFn = vi.fn(() => ({ get: getMock, set: setMock, update: updateMock, delete: deleteMock, collection: collectionMockFn }));
  collectionMockFn.mockImplementation(() => ({ doc: docMockFn, where: whereMock, get: getMock }));
  
  const batchSetMock = vi.fn();
  const batchDeleteMock = vi.fn();
  const batchCommitMock = vi.fn().mockResolvedValue(undefined);

  return { getMock, setMock, updateMock, deleteMock, collectionMock: collectionMockFn, docMock: docMockFn, whereMock, whereGetMock, batchCommitMock, batchSetMock, batchDeleteMock };
});

vi.mock('firebase-admin', () => {
  const firestoreMock = () => ({
    collection: collectionMock,
    batch: () => ({ set: batchSetMock, delete: batchDeleteMock, commit: batchCommitMock }),
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
    whereGetMock.mockResolvedValue({ empty: true, docs: [] });
  });

  it('creates new recruiter profile with 0 credits and timestamps when user doc does not exist', async () => {
    // Arrange
    getMock.mockResolvedValueOnce({ exists: false }); // User doc check
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
  });

  it('adopts existing admin-created doc by email, moving credits and archiving old doc', async () => {
    const oldDocId = 'random_admin_created_id';
    const oldDocData = {
      name: 'Admin Added Name',
      email: 'match@company.com',
      companyName: 'Admin Corp',
      credits: 5,
      totalPurchased: 5,
      role: 'recruiter',
      createdAt: { toMillis: () => 1000 }
    };
    
    whereGetMock.mockResolvedValueOnce({
      empty: false,
      docs: [{
        id: oldDocId,
        data: () => oldDocData,
        ref: { update: updateMock, collection: collectionMock }
      }]
    });
    
    // Simulate creditAuditLog returned by getMock when getting the subcollection
    getMock.mockResolvedValueOnce({
      empty: false,
      docs: [{ id: 'log1', data: () => ({ amount: 5, reason: 'grant' }), ref: 'log1_ref' }]
    });

    const payload = {
      uid: 'new_auth_uid_123',
      name: 'Real Name',
      email: 'match@company.com',
      companyName: 'Real Corp'
    };

    const res = await registerRecruiter(payload, { auth: { uid: 'new_auth_uid_123' } } as any);

    expect(res.adopted).toBe(true);
    expect(res.profile.credits).toBe(5);
    
    // Check that we merged into the new doc
    expect(setMock).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Admin Added Name',
      credits: 5,
      adoptedFrom: oldDocId,
    }), { merge: true });

    // Check old doc was archived
    expect(updateMock).toHaveBeenCalledWith({
      archived: true,
      archivedAt: '__SERVER_TIMESTAMP__',
      mergedInto: 'new_auth_uid_123'
    });

    // Check audit logs were moved
    expect(batchSetMock).toHaveBeenCalled();
    expect(batchDeleteMock).toHaveBeenCalledWith('log1_ref');
    expect(batchCommitMock).toHaveBeenCalled();
  });

  it('is idempotent on adoption: ignores docs that already have mergedInto', async () => {
    const oldDocId = 'random_admin_created_id';
    const oldDocData = {
      name: 'Already Merged',
      email: 'match@company.com',
      mergedInto: 'some_other_uid'
    };
    
    whereGetMock.mockResolvedValueOnce({
      empty: false,
      docs: [{
        id: oldDocId,
        data: () => oldDocData,
      }]
    });
    
    getMock.mockResolvedValueOnce({ exists: false }); // Fallback to normal create

    const payload = {
      uid: 'new_auth_uid_123',
      name: 'Real Name',
      email: 'match@company.com',
      companyName: 'Real Corp'
    };

    const res = await registerRecruiter(payload, { auth: { uid: 'new_auth_uid_123' } } as any);

    expect(res.created).toBe(true);
    expect(res.adopted).toBeUndefined();
    expect(res.profile.credits).toBe(0); // Did not adopt credits
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
    const payload = { name: '   ', email: 'recruiter@company.com', companyName: 'Company Inc' };
    await expect(registerRecruiter(payload, AUTH_CTX)).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('rejects missing or malformed email with invalid-argument', async () => {
    const payloadMissing = { name: 'John Doe', email: '', companyName: 'Company Inc' };
    const payloadInvalid = { name: 'John Doe', email: 'not-an-email', companyName: 'Company Inc' };
    await expect(registerRecruiter(payloadMissing, AUTH_CTX)).rejects.toMatchObject({ code: 'invalid-argument' });
    await expect(registerRecruiter(payloadInvalid, AUTH_CTX)).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('rejects missing or empty company name with invalid-argument', async () => {
    const payload = { name: 'John Doe', email: 'john@company.com', companyName: '' };
    await expect(registerRecruiter(payload, AUTH_CTX)).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('rejects invalid uid type or empty string with invalid-argument', async () => {
    const payload = { uid: '   ', name: 'John Doe', email: 'john@company.com', companyName: 'Company Inc' };
    await expect(registerRecruiter(payload, ANON_CTX)).rejects.toMatchObject({ code: 'invalid-argument' });
  });
});
