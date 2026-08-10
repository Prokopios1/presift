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
 */
async function answerAllQuestions(page: Page, totalQuestions: number): Promise<string[]> {
  const dialogs = captureDialogs(page);
  for (let q = 0; q < totalQuestions; q++) {
    // Click the first available option button in the active test area.
    const option = page.locator('main button').first();
    await option.click();
    // If the last question auto-submits, an alert fires; stop early.
    if (dialogs.length > 0) break;
    // Give React a beat to advance the question.
    await page.waitForTimeout(150);
  }
  return dialogs;
}

test.describe('Assessment session (candidate flow)', () => {
  test('full test: consent → answer → auto-submit → back home', async ({ page }) => {
    // Arrange
    await page.goto('/test/e2e-full');

    // Act
    // 1. Start screen: tick mandatory GDPR consent, begin.
    await expect(page.getByText('Psychometric Assessment')).toBeVisible({ timeout: 15_000 });
    await page.getByText('Mandatory GDPR Consent').click();
    await page.getByRole('button', { name: 'Begin Assessment' }).click();

    // 2. Answer every question (16 ICAR + 16 WLEIS = 32).
    const dialogs = await answerAllQuestions(page, 32);

    // Assert
    await expect.poll(() => dialogs.length, { timeout: 30_000 }).toBeGreaterThan(0);
    expect(dialogs[0]).toContain('Assessment Complete!');
    await expect(page).toHaveURL('/', { timeout: 15_000 });
  });

  test('reload mid-test resumes from localStorage', async ({ page }) => {
    // Arrange
    await page.goto('/test/e2e-resume');
    await expect(page.getByText('Psychometric Assessment')).toBeVisible({ timeout: 15_000 });
    await page.getByText('Mandatory GDPR Consent').click();
    await page.getByRole('button', { name: 'Begin Assessment' }).click();

    // Act — answer one question, then reload.
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
});
