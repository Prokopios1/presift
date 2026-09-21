import { test, expect } from '@playwright/test';

test.describe('Landing page (B2B psychometric engine)', () => {
  // Deterministic English chrome (I18nContext reads localStorage; default is gr).
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('presift_language', 'en');
    });
  });

  test('renders core marketing content and navigation', async ({ page }) => {
    // Arrange
    await page.goto('/');

    // Act
    const dashboardLink = page.getByRole('button', { name: 'Dashboard', exact: true });
    const adminLink = page.getByRole('button', { name: 'Admin', exact: true });
    const pricingLink = page.locator('nav').getByRole('link', { name: 'Pricing', exact: true });
    
    const headline = page.getByRole('heading', { name: /Beyond speculations: Precise metrics for cognitive power and human chemistry./i });
    const subtext = page.getByText('10 minutes to measure IQ & EQ. Zero guesswork.');
    const getStartedLink = page.getByRole('link', { name: /Get Started/i });
    const footerText = page.getByText('© 2026 PreSift. All rights reserved. GDPR Compliant.');

    // Assert
    await expect(dashboardLink).toBeVisible();
    await expect(adminLink).toBeVisible();
    await expect(pricingLink).toBeVisible();
    await expect(headline).toBeVisible();
    await expect(subtext).toBeVisible();
    await expect(getStartedLink).toBeVisible();
    await expect(footerText).toBeVisible();
  });

  test('checkout redirects to Stripe hosted checkout', async ({ page }) => {
    // Arrange
    const dialogs: string[] = [];
    page.on('dialog', async (d) => {
      dialogs.push(d.message());
      await d.accept();
    });
    page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));

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

    // Assert — real Stripe Checkout (test mode) takes over
    try {
      await page.waitForURL(/checkout\.stripe\.com/, { timeout: 15_000 });
    } catch (e) {
      if (dialogs.length > 0) {
        throw new Error(`Stripe checkout failed with dialog: ${dialogs[0]}`);
      }
      throw e;
    }
    expect(page.url()).toMatch(/checkout\.stripe\.com/);
  });
});
