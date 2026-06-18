import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const original = window.matchMedia.bind(window);
    window.matchMedia = (query: string) => {
      if (query === '(pointer: coarse)') {
        return {
          matches: true,
          media: query,
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => true,
          onchange: null,
        } as MediaQueryList;
      }
      return original(query);
    };
  });
});

test.describe('touch dismiss (coarse pointer)', () => {
  test('SearchableSelect abre e seleciona com um toque', async ({ page }) => {
    await page.goto('/test-ui/touch-select');

    const searchableSection = page.locator('main').locator('div').filter({ hasText: 'Searchable' }).first();
    const trigger = searchableSection.getByRole('button').first();

    await trigger.tap();
    await expect(page.getByRole('listbox')).toBeVisible({ timeout: 5000 });

    await page.getByRole('option', { name: 'Opção B' }).tap();
    await expect(trigger).toContainText('Opção B');
    await expect(page.getByRole('listbox')).toHaveCount(0);
  });

  test('MultiSelect abre e alterna opção com um toque', async ({ page }) => {
    await page.goto('/test-ui/touch-select');

    const multiRoot = page.locator('div.relative', {
      has: page.getByText('Multi', { exact: true }),
    });
    const trigger = multiRoot.getByRole('button').first();
    const listbox = multiRoot.getByRole('listbox');

    await trigger.tap();
    await expect(listbox).toBeVisible();

    // Playwright tap() não dispara click sintético neste layout; click cobre o fallback coarse.
    await listbox.getByRole('option', { name: 'Opção A' }).click();
    await expect(trigger).toContainText('Opção A');
  });
});
