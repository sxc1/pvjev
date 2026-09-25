import { expect, test } from '@playwright/test'

test.describe('Connect Four integration', () => {
  test.skip(({ browserName, isMobile }) => browserName !== 'chromium' || isMobile, 'Integration runs once in desktop Chromium')

  test('plays a complete RNG match and keeps both matches across tabs and refresh', async ({ page }) => {
    await page.addInitScript(() => { Math.random = () => 0 })
    await page.goto('')
    await page.getByRole('button', { name: 'Start game' }).click()
    await expect(page.getByRole('group', { name: 'Current Tic Tac Toe board' })).toBeVisible()
    await page.getByRole('button', { name: 'Connect Four' }).click()
    await expect(page.getByRole('heading', { name: 'Set up Connect Four' })).toBeVisible()
    await page.getByRole('button', { name: 'Play second' }).click()
    await page.getByRole('button', { name: 'Start game' }).click()
    await expect(page.getByRole('button', { name: 'A1, yellow' })).toBeVisible()
    for (const row of [1, 2, 3]) {
      await page.getByRole('button', { name: `B${row}, empty` }).click()
      await expect(page.getByRole('button', { name: `A${row + 1}, yellow` })).toBeVisible()
    }
    await expect(page.getByText('Defeat', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Rematch' })).toBeVisible()
    await page.getByRole('button', { name: 'Tic Tac Toe' }).click()
    await expect(page.getByRole('group', { name: 'Current Tic Tac Toe board' })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('group', { name: 'Current Tic Tac Toe board' })).toBeVisible()
    await page.getByRole('button', { name: 'Connect Four' }).click()
    await expect(page.getByText('Defeat', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'A4, yellow, winning' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Chess' })).toBeDisabled()
  })
})
