import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as functions from 'firebase-functions';

// ── Hoisted mock holders ─────────────────────────────────────────────
const { holder } = vi.hoisted(() => ({
  holder: {
    getUser: vi.fn() as ReturnType<typeof vi.fn>,
  },
}));

vi.mock('firebase-admin', () => ({
  apps: ['mock'],
  initializeApp: vi.fn(),
  firestore: () => ({
    collection: () => ({ doc: () => ({ get: async () => ({ exists: false }) }) }),
  }),
  auth: () => ({
    getUser: holder.getUser,
  }),
}));

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: { serverTimestamp: () => 'TIMESTAMP', increment: (n: number) => n },
}));

import { resolveRecruiterId } from '../utils/auth';

// ── Helper: build a minimal CallableContext ──────────────────────────
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

describe('resolveRecruiterId (claims-based)', () => {
  beforeEach(() => {
    holder.getUser.mockReset();
  });

  // ── Arrange: claim-admin caller impersonating a non-admin recruiter
  it('allows a claim-admin caller to act on behalf of a non-admin recruiter', async () => {
    // Arrange
    const adminCtx = makeContext('admin-uid', true);
    holder.getUser.mockResolvedValue({ customClaims: {} });

    // Act
    const result = await resolveRecruiterId(adminCtx, 'recruiter-uid');

    // Assert
    expect(result).toBe('recruiter-uid');
    expect(holder.getUser).toHaveBeenCalledWith('recruiter-uid');
  });

  // ── Arrange: non-admin caller tries to impersonate → blocked
  it('blocks a non-admin caller from impersonating another user', async () => {
    // Arrange
    const recruiterCtx = makeContext('recruiter-uid', false);

    // Act
    const err: any = await resolveRecruiterId(recruiterCtx, 'other-uid').catch((e: any) => e);

    // Assert
    expect(err).toBeInstanceOf(functions.https.HttpsError);
    expect(err.code).toBe('permission-denied');
    expect(String(err.message)).toMatch(/permission/i);
    // getUser should NOT have been called — we short-circuit on the caller check
    expect(holder.getUser).not.toHaveBeenCalled();
  });

  // ── Arrange: admin tries to impersonate another admin → blocked
  it('blocks an admin from impersonating another admin', async () => {
    // Arrange
    const adminCtx = makeContext('admin-uid', true);
    holder.getUser.mockResolvedValue({ customClaims: { admin: true } });

    // Act
    const err: any = await resolveRecruiterId(adminCtx, 'other-admin-uid').catch((e: any) => e);

    // Assert
    expect(err).toBeInstanceOf(functions.https.HttpsError);
    expect(err.code).toBe('permission-denied');
    expect(String(err.message)).toMatch(/impersonate/i);
  });

  // ── Arrange: caller acting as themselves (no impersonation)
  it('returns the caller uid when no payloadRecruiterId is provided', async () => {
    // Arrange
    const ctx = makeContext('self-uid', false);

    // Act
    const result = await resolveRecruiterId(ctx);

    // Assert
    expect(result).toBe('self-uid');
    expect(holder.getUser).not.toHaveBeenCalled();
  });

  // ── Arrange: caller acting as themselves (payloadRecruiterId === callerUid)
  it('returns the caller uid when payloadRecruiterId matches callerUid', async () => {
    // Arrange
    const ctx = makeContext('same-uid', false);

    // Act
    const result = await resolveRecruiterId(ctx, 'same-uid');

    // Assert
    expect(result).toBe('same-uid');
    expect(holder.getUser).not.toHaveBeenCalled();
  });

  // ── Arrange: unauthenticated caller → blocked (non-demo mode)
  it('rejects unauthenticated callers', async () => {
    // Arrange
    const ctx = makeContext(undefined, false);

    // Act
    const err: any = await resolveRecruiterId(ctx).catch((e: any) => e);

    // Assert
    expect(err).toBeInstanceOf(functions.https.HttpsError);
    expect(err.code).toBe('unauthenticated');
  });
  // ── Arrange: target has no Auth record (doc-only / legacy account)
  it('allows impersonation when target has no Auth record (user-not-found)', async () => {
    // Arrange
    const adminCtx = makeContext('admin-uid', true);
    const notFoundError = new Error('No user record found');
    (notFoundError as any).code = 'auth/user-not-found';
    holder.getUser.mockRejectedValue(notFoundError);

    // Act
    const result = await resolveRecruiterId(adminCtx, 'doc-only-uid');

    // Assert
    expect(result).toBe('doc-only-uid');
    expect(holder.getUser).toHaveBeenCalledWith('doc-only-uid');
  });
});
