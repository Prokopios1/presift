import { test, expect } from '@playwright/test';

test.describe('Landing page (B2B psychometric engine)', () => {
  // Deterministic English chrome (I18nContext reads localStorage; default is gr).
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('presift_language', 'en');
    });
  });

  test('renders core marketing content without navigation', async ({ page }) => {
    // Arrange
    await page.goto('/');

    // Act
    const headline = page.getByRole('heading', { name: /Beyond speculations/i });
    const subtitle = page.getByText('10 minutes to measure IQ & EQ. Zero guesswork.');
    const getStartedLink = page.getByRole('link', { name: /Get Started/i });

    // Assert
    await expect(headline).toBeVisible();
    await expect(subtitle).toBeVisible();
    await expect(getStartedLink).toBeVisible();
    await expect(getStartedLink).toHaveAttribute('href', '/register');
    await expect(page.locator('footer')).toContainText('© 2026 PreSift. All rights reserved. GDPR Compliant.');
    await expect(page.getByRole('button', { name: "Dashboard", exact: true })).toHaveCount(0);
    await expect(page.locator('nav')).toHaveCount(0);
  });

  test('guest checkout is blocked by the login guard', async ({ page }) => {
    // Arrange
    const dialogs: string[] = [];
    page.on('dialog', async (d) => {
      dialogs.push(d.message());
      await d.accept();
    });

    await page.goto('/pricing');

    // Act
    const unitPrice = page.getByText('€5', { exact: true });
    await expect(unitPrice).toBeVisible();
    const input = page.getByRole('spinbutton');
    await expect(input).toHaveValue('5');

    // Click +5 twice to make it 15 credits (€75)
    await page.getByRole('button', { name: '+5' }).click();
    await page.getByRole('button', { name: '+5' }).click();
    
    // Fill billing address
    await page.getByPlaceholder('Berlin, Germany').fill('123 Fake St, City');

    // Click checkout
    await page.getByRole('button', { name: 'Checkout — €75.00' }).click();

    // Assert
    await page.waitForTimeout(1000);
    expect(dialogs.length).toBeGreaterThan(0);
    expect(dialogs[0]).toContain('Must be logged in to purchase credits.');
    await expect(page).not.toHaveURL(/checkout.stripe.com/);
  });
});
