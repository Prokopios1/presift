/**
 * Tests for createCheckoutSession in Cloud Functions.
 * Covers:
 * - Auto-wiring registration data from users/<uid> into Stripe customer_email and metadata
 * - Caller override of email, companyName, vatId, billingAddress
 * - Missing profile fallback (no crash, empty metadata)
 * - Validation of quantity
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  getMock,
  collectionMock,
  docMock,
  stripeCreateMock,
} = vi.hoisted(() => {
  const getMock = vi.fn();
  const docMock = vi.fn(() => ({ get: getMock }));
  const collectionMock = vi.fn(() => ({ doc: docMock }));
  const stripeCreateMock = vi.fn();

  return { getMock, collectionMock, docMock, stripeCreateMock };
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
    config: () => ({
      stripe: { secret_key: 'sk_test_mock', webhook_secret: 'whsec_mock' },
      demo: { allow_anon: 'true' },
    }),
  };
});

vi.mock('stripe', () => {
  return {
    default: class MockStripe {
      checkout = {
        sessions: {
          create: stripeCreateMock,
        },
      };
    },
  };
});

import { createCheckoutSession } from '../stripe';

const AUTH_CTX = { auth: { uid: 'some_user' } } as any;

describe('createCheckoutSession callable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stripeCreateMock.mockResolvedValue({ url: 'https://checkout.stripe.com/c/pay/cs_test_mock' });
  });

  it('auto-wires registered recruiter profile into customer_email and metadata when not provided by caller', async () => {
    // Arrange
    const registeredUser = {
      email: 'recruiter@enterprise.com',
      companyName: 'Enterprise Hiring LLC',
      vatId: 'DE333444555',
      billingAddress: 'Tower 1, Frankfurt',
    };
    getMock.mockResolvedValueOnce({
      exists: true,
      data: () => registeredUser,
    });

    const data = {
      quantity: 10,
      uid: 'registered_recruiter_99',
      origin: 'https://app.presift.com',
    };

    // Act
    const res = await createCheckoutSession(data, AUTH_CTX);

    // Assert
    expect(res).toEqual({ url: 'https://checkout.stripe.com/c/pay/cs_test_mock' });
    expect(stripeCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        customer_email: 'recruiter@enterprise.com',
        client_reference_id: 'registered_recruiter_99',
        metadata: {
          uid: 'registered_recruiter_99',
          credits: '10',
          quantity: '10',
          companyName: 'Enterprise Hiring LLC',
          vatId: 'DE333444555',
          email: 'recruiter@enterprise.com',
        },
      })
    );
  });

  it('prefers caller-provided fields over registered profile when caller provides overrides', async () => {
    // Arrange
    const registeredUser = {
      email: 'registered@corp.com',
      companyName: 'Old Company',
      vatId: 'DE111',
    };
    getMock.mockResolvedValueOnce({
      exists: true,
      data: () => registeredUser,
    });

    const data = {
      quantity: 5,
      uid: 'registered_recruiter_99',
      email: 'override@corp.com',
      companyName: 'Custom Billing Name Ltd',
      vatId: 'DE999',
    };

    // Act
    const res = await createCheckoutSession(data, AUTH_CTX);

    // Assert
    expect(res).toEqual({ url: 'https://checkout.stripe.com/c/pay/cs_test_mock' });
    expect(stripeCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        customer_email: 'override@corp.com',
        metadata: {
          uid: 'registered_recruiter_99',
          credits: '5',
          quantity: '5',
          companyName: 'Custom Billing Name Ltd',
          vatId: 'DE999',
          email: 'override@corp.com',
        },
      })
    );
  });

  it('handles missing user profile gracefully without crash', async () => {
    // Arrange
    getMock.mockResolvedValueOnce({
      exists: false,
    });

    const data = {
      quantity: 3,
      uid: 'unknown_user',
    };

    // Act
    const res = await createCheckoutSession(data, AUTH_CTX);

    // Assert
    expect(res).toEqual({ url: 'https://checkout.stripe.com/c/pay/cs_test_mock' });
    expect(stripeCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        customer_email: undefined,
        metadata: {
          uid: 'unknown_user',
          credits: '3',
          quantity: '3',
          companyName: '',
          vatId: '',
          email: '',
        },
      })
    );
  });

  it('rejects invalid quantity (<1 or >200)', async () => {
    // Arrange & Act & Assert
    await expect(createCheckoutSession({ quantity: 0 }, AUTH_CTX)).rejects.toMatchObject({
      code: 'invalid-argument',
    });
    await expect(createCheckoutSession({ quantity: 201 }, AUTH_CTX)).rejects.toMatchObject({
      code: 'invalid-argument',
    });
  });
});
