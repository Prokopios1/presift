import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Static guards on the repo-root firestore.rules file — it is deployed
 * verbatim, so these assertions protect the production hardening from
 * regressions (e.g. someone re-enabling a dev `allow ... if true` block).
 */
function resolveRulesPath(): string {
  // Works under both the repo-root vitest (cwd = repo root) and the
  // functions vitest (cwd = functions/).
  const candidates = [
    join(process.cwd(), 'firestore.rules'),
    join(process.cwd(), '..', 'firestore.rules'),
  ];
  const found = candidates.find(existsSync);
  if (!found) throw new Error(`firestore.rules not found (tried: ${candidates.join(', ')})`);
  return found;
}

const rules = readFileSync(resolveRulesPath(), 'utf8');

function blockFor(matchLine: string): string {
  const m = rules.match(new RegExp(`match ${matchLine} \\{[\\s\\S]*?\\n    \\}`));
  if (!m) throw new Error(`No rules block found for: ${matchLine}`);
  return m[0];
}

describe('firestore.rules production hardening', () => {
  it('contains NO anonymous mutation rule anywhere (no create/update/delete/write ... if true)', () => {
    expect(rules).not.toMatch(/allow\s+(?:create|update|delete|write)[^;]*if\s+true/);
  });

  it('candidates: create/update/delete locked to functions; read stays available for the dashboard', () => {
    const candidates = blockFor('/candidates/\\{candidateId\\}');
    expect(candidates).toContain('allow read: if true;');
    expect(candidates).toContain('allow create, update, delete: if false;');
  });

  it('sessions: fully server-managed (no client read/write/delete)', () => {
    const sessions = blockFor('/sessions/\\{sessionId\\}');
    expect(sessions).toContain('allow read, create, update, delete: if false;');
  });

  it('users and assessments: reads allowed, writes functions-only', () => {
    const users = blockFor('/users/\\{userId\\}');
    expect(users).toContain('allow read: if true;');
    expect(users).toContain('allow write: if false;');

    const assessments = blockFor('/assessments/\\{assessmentId\\}');
    expect(assessments).toContain('allow read: if true;');
    expect(assessments).toContain('allow write: if false;');
  });
});
