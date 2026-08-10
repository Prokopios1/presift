import { test, expect } from '@playwright/test';

test.describe('Landing page (B2B psychometric engine)', () => {
  test('renders core marketing content and new pricing UI', async ({ page }) => {
    // Arrange
    await page.goto('/');

    // Act
    const headline = page.getByRole('heading', { name: /Stop interviewing candidates who look good on paper but fail under pressure./i });
    const badge = page.getByText('B2B Psychometric Screening Engine');
    const trialButton = page.getByRole('button', { name: 'Start Free Trial (5 Credits)' });
    const demoButton = page.getByRole('button', { name: 'View Demo Dashboard →' });
    const unitPrice = page.getByText('€5');
    const minusFive = page.getByRole('button', { name: '−5' });
    const minus = page.getByRole('button', { name: '−', exact: true });
    const plus = page.getByRole('button', { name: '+', exact: true });
    const plusFive = page.getByRole('button', { name: '+5' });
    const input = page.getByRole('spinbutton');
    const billingAddress = page.getByPlaceholder('Berlin, Germany');
    const checkout = page.getByRole('button', { name: 'Checkout — €25.00' });

    // Assert
    await expect(headline).toBeVisible();
    await expect(badge).toBeVisible();
    await expect(trialButton).toBeVisible();
    await expect(demoButton).toBeVisible();
    await expect(unitPrice).toBeVisible();
    await expect(minusFive).toBeVisible();
    await expect(minus).toBeVisible();
    await expect(plus).toBeVisible();
    await expect(plusFive).toBeVisible();
    await expect(input).toHaveValue('5');
    await expect(billingAddress).toBeVisible();
    await expect(checkout).toBeVisible();
  });

  test('checkout redirects to Stripe hosted checkout', async ({ page }) => {
    // Arrange
    const dialogs: string[] = [];
    page.on('dialog', async (d) => {
      dialogs.push(d.message());
      await d.accept();
    });
    page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));

    await page.goto('/');

    // Act
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
