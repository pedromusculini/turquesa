import { test, expect } from '@playwright/test';

test.describe('Páginas públicas — smoke', () => {
  test('landing carrega', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Turquesa Agenda/i);
  });

  test('privacidade e seção cookies', async ({ page }) => {
    await page.goto('/privacidade');
    await expect(page.locator('#cookies')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Cookies e tecnologias similares' })).toBeVisible();
  });

  test('termos carrega', async ({ page }) => {
    await page.goto('/termos');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('login carrega', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /Turquesa Agenda/i })).toBeVisible();
  });
});

test.describe('Cookie consent banner', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.removeItem('turquesa-agenda-cookie-consent');
    });
  });

  test('banner aparece e pode ser aceito', async ({ page }) => {
    await page.goto('/');
    const dialog = page.getByRole('dialog', { name: /cookies/i });
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: /entendi/i }).click();
    await expect(dialog).toBeHidden();
    const stored = await page.evaluate(() =>
      window.localStorage.getItem('turquesa-agenda-cookie-consent'),
    );
    expect(stored).toContain('2026-06-23');
  });
});
