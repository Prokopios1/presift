import { describe, it, expect, afterEach } from 'vitest';
import { seedDemoData } from '../seeder';

/**
 * seedDemoData is destructive (it batch-deletes every candidate for
 * demo_recruiter before writing demo rows). It must refuse to run outside the
 * local emulator so it can never wipe real production candidates again.
 */
describe('seedDemoData emulator gate', () => {
  const OLD_EMULATOR = process.env.FUNCTIONS_EMULATOR;

  afterEach(() => {
    if (OLD_EMULATOR === undefined) delete process.env.FUNCTIONS_EMULATOR;
    else process.env.FUNCTIONS_EMULATOR = OLD_EMULATOR;
  });

  it('refuses to run outside the emulator (failed-precondition)', async () => {
    delete process.env.FUNCTIONS_EMULATOR;

    const err: any = await (seedDemoData as any).run({}, {}).catch((e: any) => e);

    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe('failed-precondition');
    expect(String(err.message)).toMatch(/emulator/i);
  });

  it('refuses even when demo.allow_anon style demo mode is implied (no emulator env)', async () => {
    // Guard must NOT be satisfiable by any config other than the emulator env.
    delete process.env.FUNCTIONS_EMULATOR;

    const err: any = await (seedDemoData as any).run({}, {}).catch((e: any) => e);

    expect(err.code).toBe('failed-precondition');
    expect(String(err.message)).toMatch(/disabled outside the local emulator/i);
  });

  it('passes the gate when FUNCTIONS_EMULATOR=true (reaches the DB layer)', async () => {
    process.env.FUNCTIONS_EMULATOR = 'true';

    const err: any = await (seedDemoData as any).run({}, {}).catch((e: any) => e);

    // Gate opened: without a running emulator the admin SDK fails later — but
    // crucially it must NOT be the refusal error.
    expect(err.code).not.toBe('failed-precondition');
    expect(String(err.message)).not.toMatch(/disabled outside the local emulator/i);
  });
});
