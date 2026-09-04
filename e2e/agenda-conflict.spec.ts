import { test, expect } from '@playwright/test';

test.describe('modal de conflito de horário', () => {
  test('Depois fecha o modal e não trava a página', async ({ page }) => {
    await page.goto('/test-ui/agenda-conflict');

    const dialog = page.getByRole('dialog', { name: 'Conflito de horário' });
    await expect(dialog).toBeVisible();
    await expect(page.getByTestId('conflict-status')).toHaveText('modal-open');

    await dialog.getByRole('button', { name: 'Depois' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByTestId('conflict-status')).toHaveText('dismissed');
    await expect(page.getByTestId('reopen-conflict')).toBeVisible();
  });

  test('escolhe Google e Turquesa', async ({ page }) => {
    await page.goto('/test-ui/agenda-conflict');

    const dialog = page.getByRole('dialog', { name: 'Conflito de horário' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/Google/i).first()).toBeVisible();
    await expect(dialog.getByText(/Turquesa/i).first()).toBeVisible();

    await dialog.getByRole('button', { name: /Google/i }).click();
    await expect(page.getByTestId('conflict-status')).toHaveText('chose-google');

    await page.getByTestId('reopen-conflict').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: /Turquesa/i }).click();
    await expect(page.getByTestId('conflict-status')).toHaveText('chose-turquesa');
  });
});
