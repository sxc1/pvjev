import { expect, test } from '@playwright/test'

test('plays as X, persists, reviews, resigns, and rematches', async ({ page }) => {
  await page.goto('')
  await expect(page).toHaveTitle('Play vs Jev · Tic Tac Toe')
  await page.getByRole('button', { name: 'Start game' }).click()
  await page.getByRole('button', { name: /A3, empty/i }).click()
  await expect(page.locator('.ttt-history-entry')).toHaveCount(2)

  const mobileHistoryToggle = page.locator('.ttt-mobile-toggle')
  if (await mobileHistoryToggle.isVisible()) await mobileHistoryToggle.click()
  await page.locator('.ttt-history-entry').first().click()
  await expect(page.locator('.ttt-inspection-title')).toContainText('Reviewing 1')
  await expect(page.getByRole('group', { name: 'Historical Tic Tac Toe board' })).toBeVisible()
  await page.reload()
  await expect(page.locator('.ttt-history-entry')).toHaveCount(2)
  await expect(page.getByRole('group', { name: 'Current Tic Tac Toe board' })).toBeVisible()

  await page.getByRole('button', { name: 'Resign' }).click()
  await page.getByRole('dialog', { name: 'Resign this match?' }).getByRole('button', { name: 'Resign' }).click()
  await expect(page.locator('.pv-board-status')).toHaveText('Defeat')
  await page.getByRole('button', { name: 'Rematch' }).click()
  await expect(page.getByRole('heading', { name: 'Choose your side' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Play as X' })).toHaveAttribute('aria-pressed', 'true')
})

test('CPU opens when the human chooses O and its move survives reload', async ({ page }) => {
  await page.goto('')
  await page.getByRole('button', { name: 'Play as O' }).click()
  await page.getByRole('button', { name: 'Start game' }).click()
  await expect(page.locator('.ttt-history-entry')).toHaveCount(1)
  await expect(page.locator('.pv-board-status')).toHaveText('Your turn')
  await page.reload()
  await expect(page.locator('.ttt-history-entry')).toHaveCount(1)
  await expect(page.locator('.pv-board-status')).toHaveText('Your turn')
})
