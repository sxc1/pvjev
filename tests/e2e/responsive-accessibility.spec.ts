import { expect, test, type Page } from '@playwright/test'
import { MATCH_STORAGE_KEY } from '../../src/contracts/persistence'
import { humanTurnMatch, wonMatch } from '../fixtures/v05'

const doubleLineWin = {
  schemaVersion: 1,
  match: {
    gameId: 'tic-tac-toe', id: 'fixture-double-line-win', humanSymbol: 'X',
    moves: [
      { ply: 1, symbol: 'X', cell: 0, actor: 'human', provenance: 'human' },
      { ply: 2, symbol: 'O', cell: 1, actor: 'cpu', provenance: 'rng' },
      { ply: 3, symbol: 'X', cell: 2, actor: 'human', provenance: 'human' },
      { ply: 4, symbol: 'O', cell: 3, actor: 'cpu', provenance: 'rng' },
      { ply: 5, symbol: 'X', cell: 6, actor: 'human', provenance: 'human' },
      { ply: 6, symbol: 'O', cell: 5, actor: 'cpu', provenance: 'rng' },
      { ply: 7, symbol: 'X', cell: 8, actor: 'human', provenance: 'human' },
      { ply: 8, symbol: 'O', cell: 7, actor: 'cpu', provenance: 'rng' },
      { ply: 9, symbol: 'X', cell: 4, actor: 'human', provenance: 'human' },
    ],
    position: {
      board: ['X', 'O', 'X', 'O', 'X', 'O', 'X', 'O', 'X'],
      nextSymbol: 'O',
      outcome: { kind: 'win', winner: 'X', winningLines: [[0, 4, 8], [2, 4, 6]] },
      winningLines: [[0, 4, 8], [2, 4, 6]],
    },
    outcome: { kind: 'win', winner: 'X', winningLines: [[0, 4, 8], [2, 4, 6]] },
  },
  recovery: { consecutiveInvalid: 0 },
}

async function seedMatch(page: Page, match: unknown) {
  await page.addInitScript(({ key, value }) => {
    localStorage.setItem(key, JSON.stringify(value))
  }, { key: MATCH_STORAGE_KEY, value: match })
  await page.goto('')
}

test.describe('B4 responsive presentation', () => {
  test.skip(({ browserName, isMobile }) => browserName !== 'chromium' || isMobile, 'Viewport matrix runs once in desktop Chromium')

  for (const viewport of [
    { width: 1920, height: 1080 },
    { width: 2560, height: 1440 },
    { width: 390, height: 844 },
    { width: 412, height: 915 },
    { width: 320, height: 640 },
  ]) {
    test(`${viewport.width}×${viewport.height}: board, history, and controls fit`, async ({ page }) => {
      await page.setViewportSize(viewport)
      await seedMatch(page, { schemaVersion: 1, match: humanTurnMatch, recovery: { consecutiveInvalid: 0 } })

      const board = page.getByRole('group', { name: 'Current Tic Tac Toe board' })
      await expect(board).toBeVisible()
      await expect(page.getByRole('button', { name: /A3, X, inspect/i })).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width)

      if (viewport.width < 900) {
        await page.getByRole('button', { name: 'Show history' }).click()
      }
      await page.locator('.pv-history-entry').first().click()
      await expect(page.getByRole('group', { name: 'Historical Tic Tac Toe board' })).toBeVisible()
      const historicalBox = await page.getByRole('group', { name: 'Historical Tic Tac Toe board' }).boundingBox()
      expect(historicalBox).not.toBeNull()
      expect(historicalBox!.x).toBeGreaterThanOrEqual(0)
      expect(historicalBox!.x + historicalBox!.width).toBeLessThanOrEqual(viewport.width + 1)

      if (viewport.width < 900) {
        const toggle = page.getByRole('button', { name: 'Hide history' })
        await expect(toggle).toHaveAttribute('aria-expanded', 'true')
        await toggle.click()
        await expect(page.getByRole('button', { name: 'Show history' })).toHaveAttribute('aria-expanded', 'false')
        await expect(page.locator('.pv-history-entry').first()).toBeHidden()
        await page.getByRole('button', { name: 'Show history' }).click()
        await expect(page.locator('.pv-history-entry').first()).toBeVisible()
      } else {
        await expect(page.locator('.pv-history-entry').first()).toBeVisible()
      }

      const undersized = await page.locator('button:visible:not(:disabled)').evaluateAll((buttons) =>
        buttons.filter((button) => {
          const rect = button.getBoundingClientRect()
          return rect.width < 44 || rect.height < 44
        }).map((button) => ({ label: button.getAttribute('aria-label') ?? button.textContent?.trim(), rect: button.getBoundingClientRect().toJSON() })),
      )
      expect(undersized).toEqual([])
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width)
    })
  }

  test('overlapping winning lines retain the latest-move outline', async ({ page }) => {
    await seedMatch(page, doubleLineWin)
    const winning = page.locator('.ttt-cell-win-human')
    await expect(winning).toHaveCount(5)
    await expect(page.getByRole('button', { name: /B2, X, inspect/i })).toHaveClass(/ttt-cell-latest/)
    await page.getByRole('button', { name: /B2, X, inspect/i }).click()
    await expect(page.getByRole('group', { name: 'Historical Tic Tac Toe board' })).toBeVisible()
    await expect(page.getByRole('button', { name: /B2, X, inspect/i })).toHaveClass(/ttt-cell-reviewed/)
    await expect(page.getByRole('button', { name: /B2, X, inspect/i })).toHaveClass(/ttt-cell-win-human/)
  })
})

test.describe('B5 browser controls', () => {
  test('keyboard play, meaningful labels, game navigation, and Escape focus return', async ({ page }) => {
    await page.goto('')
    await expect(page.getByRole('button', { name: 'Connect Four' })).toBeEnabled()
    await expect(page.getByRole('button', { name: 'Chess' })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Tic Tac Toe' })).toHaveAttribute('aria-current', 'page')
    await page.getByRole('button', { name: 'Start game' }).click()
    const cell = page.getByRole('button', { name: 'A3, empty, play here' })
    await cell.focus()
    await expect(cell).toBeFocused()
    await page.keyboard.press('Space')
    await expect(page.getByRole('button', { name: /A3, X, inspect 1x A3/i })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Resign' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Resign' })).toBeVisible()

    const resign = page.getByRole('button', { name: 'Resign' })
    await resign.focus()
    await page.keyboard.press('Enter')
    const dialog = page.getByRole('dialog', { name: 'Resign this match?' })
    await expect(dialog).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(resign).toBeFocused()
    await expect(page.getByRole('button', { name: 'Connect Four' })).toBeEnabled()
    await expect(page.getByRole('button', { name: 'Chess' })).toBeDisabled()
    await expect(page).toHaveURL(/\/pvjev\/?$/)
  })

  test('reduced motion removes the pending move animation', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await seedMatch(page, { schemaVersion: 1, match: humanTurnMatch, recovery: { consecutiveInvalid: 0 } })
    await page.getByRole('button', { name: 'Settings' }).click()
    await page.getByRole('checkbox', { name: 'Confirm moves before playing' }).check()
    await page.getByRole('button', { name: 'C3, empty, play here' }).click()
    await expect(page.getByRole('button', { name: /C3, empty, pending move/i })).toBeVisible()
    expect(await page.locator('.ttt-preview').evaluate((element) => getComputedStyle(element).animationName)).toBe('none')
    await expect(page.getByRole('button', { name: 'Confirm move' })).toBeVisible()
  })

  test('review keeps live status and disables empty historical cells', async ({ page }) => {
    await seedMatch(page, { schemaVersion: 1, match: wonMatch, recovery: { consecutiveInvalid: 0 } })
    await expect(page.getByRole('button', { name: 'Rematch' })).toBeVisible()
    const showHistory = page.getByRole('button', { name: 'Show history' })
    if (await showHistory.isVisible()) await showHistory.click()
    await page.locator('.pv-history-entry').first().click()
    await expect(page.getByRole('button', { name: 'Rematch' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'C3, empty, unavailable' })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Return to current' })).toBeVisible()
  })
})
