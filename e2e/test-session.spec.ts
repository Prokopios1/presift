import { test, expect, type Page } from '@playwright/test';

function captureDialogs(page: Page): string[] {
  const messages: string[] = [];
  page.on('dialog', async (d) => {
    messages.push(d.message());
    await d.accept();
  });
  return messages;
}

/**
 * Drives a full assessment session at /test/:assessmentId.
 * ICAR items = 4 options, WLEIS items = Likert scale options.
 * Intro screens (ICAR/WLEIS) render their CTA ("Go") OUTSIDE <main>, so the
 * helper clicks the intro "Go" button whenever no <main> option is present.
 */
async function answerAllQuestions(page: Page, totalQuestions: number): Promise<string[]> {
  const dialogs = captureDialogs(page);
  const go = page.getByRole('button', { name: 'Go', exact: true });
  const smileOption = page.getByRole('button', { name: /Spontaneous|Posed/ }).first();
  const option = page.locator('main button').first();
  // Cap generously: ICAR + WLEIS + SMILE trials + intro transitions.
  for (let q = 0; q < 80; q++) {
    if (await option.isVisible().catch(() => false)) {
      await option.click();
    } else if (await go.isVisible().catch(() => false)) {
      const ack = page.getByRole('checkbox', { name: /I have read/i });
      if (await ack.isVisible().catch(() => false)) {
        await ack.check();
      }
      // Stage-1 intro gates on a SECOND box (GDPR consent) before Go enables.
      const stageConsent = page.getByRole('checkbox', { name: /Mandatory GDPR Consent/i });
      if (await stageConsent.isVisible().catch(() => false)) {
        await stageConsent.check();
      }
      await go.click();
    } else if (await smileOption.isVisible().catch(() => false)) {
      await smileOption.click();
    } else {
      break;
    }
    // If the last question auto-submits, an alert fires; stop early.
    if (dialogs.length > 0) break;
    // Give React a beat to advance the question.
    await page.waitForTimeout(150);
  }
  return dialogs;
}

test.describe('Assessment session (candidate flow)', () => {
  // Deterministic English chrome by default for every spec in this file (the
  // React I18nContext reads localStorage; see I18nContext.tsx). Real candidate
  // links created with lang:'el' override this to Greek once startSession
  // resolves (TestPage switches on session.lang). Synthetic /test/... links
  // carry no lang and keep this English seed.
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('presift_language', 'en');
    });
  });

  test('full test: create link → consent → answer → auto-submit → back home', async ({ page, request }) => {
    // Arrange — create a REAL candidate link through the callable (doc-less
    // links now fail loudly by design), then drive the candidate UI on it.
    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5174';
    const isLocal = /localhost|127\.0\.0\.1/.test(base);
    const functionsOrigin = isLocal
      ? 'http://127.0.0.1:5001/presift/us-central1'
      : 'https://us-central1-presift.cloudfunctions.net';

    // Local emulator only: a fresh emulator DB has no demo_recruiter user, so
    // seed it (seedDemoData is anon-allowed under FUNCTIONS_EMULATOR and
    // idempotent — creates users/demo_recruiter with 5 credits). Live has real
    // credits — never touched here.
    if (isLocal) {
      const seed = await request.post(`${functionsOrigin}/seedDemoData`, {
        data: { data: {} },
      });
      expect(seed.ok()).toBeTruthy();
    }

    const created = await request.post(`${functionsOrigin}/createAssessmentLink`, {
      data: { data: { roleTitle: 'E2E Engineer', candidateName: 'E2E Candidate', candidateEmail: 'e2e@example.com', lang: 'en', recruiterId: 'demo_recruiter' } },
    });
    expect(created.ok()).toBeTruthy();
    const createdBody = await created.json();
    const candidateId = createdBody?.result?.candidateId;
    expect(candidateId).toBeTruthy();

    await page.goto(`/assessment/${candidateId}`);

    // Act
    // 1. Start screen: tick mandatory GDPR consent, begin.
    await expect(page.getByText('Psychometric Assessment')).toBeVisible({ timeout: 15_000 });
    await page.getByText('Mandatory GDPR Consent').click();
    await page.getByRole('button', { name: 'Begin Assessment' }).click();

    // 2. Answer every question (11 ICAR + 16 WLEIS) plus SMILE trials — the
    // helper also clicks the intro "Go" gates and smile answers.
    const dialogs = await answerAllQuestions(page, 32);

    // Assert — the dedicated Thank You page confirms submission (no in-page
    // completion panel, no results shown).
    await expect(page).toHaveURL(/\/thank-you/, { timeout: 30_000 });
    await expect(page.getByText('Assessment Complete')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Thank you for completing/)).toBeVisible({ timeout: 15_000 });
  });

  test('reload mid-test resumes from localStorage', async ({ page }) => {
    // Arrange
    await page.goto('/test/e2e-resume');
    await expect(page.getByText('Psychometric Assessment')).toBeVisible({ timeout: 15_000 });
    await page.getByText('Mandatory GDPR Consent').click();
    await page.getByRole('button', { name: 'Begin Assessment' }).click();
    // ICAR intro screen: its CTA ("Go") is outside <main> — click it to reach
    // the first question, then answer one and reload.
    const ack = page.getByRole('checkbox', { name: /I have read/i });
    await ack.check();
    await page.getByRole('checkbox', { name: /Mandatory GDPR Consent/i }).check();
    await page.getByRole('button', { name: 'Go', exact: true }).click();
    await page.locator('main button').first().click();
    await page.waitForTimeout(300);
    await page.reload();

    // Assert — session resumes in active test view (not the consent screen).
    await expect(page.locator('main button').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Psychometric Assessment')).toHaveCount(0);
  });

  test('context menu and copy are blocked during test', async ({ page }) => {
    // Arrange
    await page.goto('/test/e2e-anticheat');
    await expect(page.getByText('Psychometric Assessment')).toBeVisible({ timeout: 15_000 });
    await page.getByText('Mandatory GDPR Consent').click();
    await page.getByRole('button', { name: 'Begin Assessment' }).click();

    // Act — attempt to open context menu / copy.
    const contextMenuOpened = page.evaluate(() => {
      let prevented = false;
      const listener = (_e: Event) => { prevented = true; };
      document.addEventListener('contextmenu', listener, { once: true });
      document.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
      document.removeEventListener('contextmenu', listener);
      return prevented;
    });

    // Assert
    expect(await contextMenuOpened).toBe(true);
  });

  test('Greek candidate link renders ICAR instructions in Greek', async ({ page, request }) => {
    // Arrange — Greek copy comes verbatim from src/locales/gr.json
    // (test_page.stage1_title):
    //   "Στάδιο 1: Γνωστική Αξιολόγηση (ICAR)"
    const base = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5174';
    const isLocal = /localhost|127\.0\.0\.1/.test(base);
    const functionsOrigin = isLocal
      ? 'http://127.0.0.1:5001/presift/us-central1'
      : 'https://us-central1-presift.cloudfunctions.net';

    if (isLocal) {
      const seed = await request.post(`${functionsOrigin}/seedDemoData`, {
        data: { data: {} },
      });
      expect(seed.ok()).toBeTruthy();
    }

    // Create a GREEK-language candidate link (default server lang) and confirm
    // the link stores lang:'el' on the candidate doc.
    const created = await request.post(`${functionsOrigin}/createAssessmentLink`, {
      data: { data: { roleTitle: 'Ελληνας Μηχανικός', candidateName: 'Ελένη Δοκιμή', candidateEmail: 'elene@example.com', lang: 'el', recruiterId: 'demo_recruiter' } },
    });
    expect(created.ok()).toBeTruthy();
    const createdBody = await created.json();
    const candidateId = createdBody?.result?.candidateId;
    expect(candidateId).toBeTruthy();

    // Act — open the link, consent, and move into the ICAR instruction stage.
    await page.goto(`/assessment/${candidateId}`);
    await expect(page.getByText('Ψυχομετρική Αξιολόγηση')).toBeVisible({ timeout: 15_000 });
    await page.getByText('Συναίνεση GDPR (Υποχρεωτικό)').click();
    await page.getByRole('button', { name: 'Έναρξη Αξιολόγησης' }).click();

    // Assert — ICAR instruction headline now in Greek (gr.json stage1_title),
    // never the English fallback.
    await expect(
      page.getByText('Στάδιο 1: Γνωστική Αξιολόγηση (ICAR)')
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Stage 1: Cognitive Reasoning/)).toHaveCount(0);
  });
});
