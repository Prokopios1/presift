import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as admin from 'firebase-admin';

const { setMock, addMock, collectionMock } = vi.hoisted(() => {
  return {
    setMock: vi.fn(),
    addMock: vi.fn(),
    collectionMock: vi.fn()
  };
});

vi.mock('firebase-admin', () => {
  const docMock = vi.fn(() => ({ set: setMock }));
  const collMock = vi.fn((path) => {
    collectionMock(path);
    if (path.includes('creditAuditLog')) {
      return { add: addMock };
    }
    return { doc: docMock, add: addMock };
  });
  
  const firestoreMock = () => ({ collection: collMock });

  return {
    apps: ['mock'],
    initializeApp: vi.fn(),
    firestore: Object.assign(firestoreMock, {
      FieldValue: {
        serverTimestamp: vi.fn(() => 'mock-timestamp')
      }
    })
  };
});

vi.mock('firebase-functions', () => {
  class HttpsError extends Error {
    constructor(public code: string, message: string) {
      super(message);
    }
  }
  return {
    https: {
      onCall: (handler: any) => handler,
      onRequest: (handler: any) => handler,
      HttpsError
    },
    pubsub: {
      schedule: () => ({ onRun: (handler: any) => handler })
    },
    config: () => ({ demo: { allow_anon: 'true' } })
  };
});

import { createClient } from '../index';

describe('createClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('validates input and creates user and audit log', async () => {
    const data = {
      companyName: 'Test Corp',
      email: 'test@example.com',
      vatId: '123',
      credits: 10,
      reason: 'test reason'
    };

    collectionMock.mockReturnValue({ add: addMock }); // so userRef.collection().add works
    addMock.mockResolvedValueOnce({ id: 'new_user_id', collection: collectionMock }); // for users collection
    addMock.mockResolvedValueOnce({ id: 'new_audit_id' }); // for audit log

    const result = await createClient(data, {} as any);

    expect(result).toEqual({ id: 'new_user_id' });
    expect(collectionMock).toHaveBeenCalledWith('users');
    expect(collectionMock).toHaveBeenCalledWith('creditAuditLog');
    
    // First add is for the user
    expect(addMock).toHaveBeenNthCalledWith(1, expect.objectContaining({
      companyName: 'Test Corp',
      email: 'test@example.com',
      vatId: '123',
      credits: 10,
      totalSpent: 0
    }));

    // Second add is for the audit log
    expect(addMock).toHaveBeenNthCalledWith(2, expect.objectContaining({
      adjustedBy: 'admin',
      amount: 10,
      newBalance: 10,
      previousBalance: 0,
      reason: 'test reason'
    }));
  });

  it('throws on invalid credits', async () => {
    const data = { companyName: 'Test', email: 'test@test.com', credits: -5, reason: 'test' };
    await expect(createClient(data, {} as any)).rejects.toThrow('Credits must be a non-negative number');
  });

  it('throws on missing required fields', async () => {
    const data = { companyName: '', email: 'test@test.com', credits: 5, reason: 'test' };
    await expect(createClient(data, {} as any)).rejects.toThrow('Company name is required');
  });
});
