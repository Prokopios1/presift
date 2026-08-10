import bankJson from './presift-bank.json';

// We map it to any or explicitly cast it because TS complains about imported JSON lacking strict interface definitions sometimes.
export const bank = bankJson as any;
