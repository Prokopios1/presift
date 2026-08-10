import '@testing-library/jest-dom';
import { vi } from 'vitest';

vi.mock('firebase/functions', () => ({
  getFunctions: vi.fn(),
  connectFunctionsEmulator: vi.fn(),
  httpsCallable: vi.fn(() => async () => ({
    data: {
      sessionId: 'sess_123',
      items: Array.from({ length: 16 }, (_, i) => ({
        itemId: `icar_${i}`,
        domain: 'cognitive',
        prompt: `Prompt ${i}`,
        options: ['A', 'B', 'C', 'D']
      })),
      wleisItems: Array.from({ length: 16 }, (_, i) => ({
        itemId: `wleis_${i}`,
        domain: 'wleis',
        prompt: `WLEIS ${i}`,
        options: ['1', '2', '3', '4', '5', '6', '7']
      }))
    }
  }))
}));

vi.mock('@/lib/firebase', () => ({
  functions: {},
  db: {}
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  getDocs: vi.fn(() => Promise.resolve({ docs: [] })),
  doc: vi.fn(),
  getDoc: vi.fn(() => Promise.resolve({ exists: () => false, data: () => ({}) })),
  setDoc: vi.fn(() => Promise.resolve()),
  updateDoc: vi.fn(() => Promise.resolve()),
  deleteDoc: vi.fn(() => Promise.resolve()),
  getFirestore: vi.fn(),
  connectFirestoreEmulator: vi.fn()
}));
