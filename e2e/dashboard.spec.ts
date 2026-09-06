import { test, expect, type Page } from '@playwright/test';

function captureDialogs(page: Page): string[] {
  const messages: string[] = [];
  page.on('dialog', async (d) => {
    messages.push(d.message());
    await d.accept();
  });
  return messages;
}

test.describe('Dashboard (mock recruiter flows)', () => {
  // Deterministic English chrome (I18nContext reads localStorage; default is gr).
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('presift_language', 'en');
    });
  });

  test('mock login lands on dashboard', async ({ page }) => {
    // Arrange
    await page.goto('/dashboard?demo=true');

    // Act
    await page.getByRole('button', { name: /Recruiter Login/ }).click();

    // Assert
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole('heading', { name: 'Recruiter Dashboard' })).toBeVisible();
  });

  test('seed demo data populates candidates table', async ({ page }) => {
    // Arrange
    const _dialogs = captureDialogs(page);
    await page.goto('/dashboard?demo=true');
    await page.getByRole('button', { name: /Recruiter Login/ }).click();
    await expect(page.getByRole('heading', { name: 'Recruiter Dashboard' })).toBeVisible();

    await page.goto('/dashboard?demo=true');

    // Act
    await page.getByRole('button', { name: /Seed Demo Data/ }).click();

    // Assert
    await expect(page.getByText('Alice Strong')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Harry Flag')).toBeVisible();
    await expect(page.getByText('Balance')).toBeVisible();
  });

  test('candidate drawer opens and shows score breakdown', async ({ page }) => {
    // Arrange
    await page.goto('/dashboard?demo=true');
    await page.getByRole('button', { name: /Recruiter Login/ }).click();
    await expect(page.getByRole('heading', { name: 'Recruiter Dashboard' })).toBeVisible();
    
    await page.goto('/dashboard?demo=true');
    await page.getByRole('button', { name: /Seed Demo Data/ }).click();
    await expect(page.getByText('Alice Strong')).toBeVisible({ timeout: 15_000 });

    // Act
    await page.getByText('Alice Strong').locator('..').getByRole('button', { name: 'View' }).click();

    // Assert
    await expect(page.getByText('Cognitive (ICAR)')).toBeVisible();
    await expect(page.getByText('Emotional Intelligence', { exact: true })).toBeVisible();
    await expect(page.getByText('Custom Interview Prompts')).toBeVisible();
  });
});

