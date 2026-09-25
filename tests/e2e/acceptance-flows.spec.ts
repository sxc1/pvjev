import { expect, test, type Page } from '@playwright/test'
import { validSaves } from '../fixtures/v05'

const matchKey = 'pvjev:v0.5:match:tic-tac-toe'
async function seedMatch(page: Page, save: unknown) {
  await page.addInitScript(({ key, value }) => {
    if (sessionStorage.getItem('acceptance-fixture-seeded')) return
    localStorage.setItem(key, JSON.stringify(value))
    sessionStorage.setItem('acceptance-fixture-seeded', 'true')
  }, {
    key: matchKey, value: save,
  })
}

async function storedMatch(page: Page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key)!) as typeof validSaves.humanTurn, matchKey)
}

async function clickCell(page: Page, coordinate: string) {
  await page.getByRole('button', { name: new RegExp(`^${coordinate}, empty, play here$`) }).click()
}

async function showHistoryOnMobile(page: Page) {
  const toggle = page.getByRole('button', { name: 'Show history' })
  if (await toggle.isVisible()) await toggle.click()
}

test('B1: X and O starts produce legal CPU moves with ordinary RNG provenance', async ({ page }) => {
  await page.goto('')
  await page.getByRole('button', { name: 'Start game' }).click()
  await clickCell(page, 'A3')
  await expect(page.locator('.ttt-history-entry')).toHaveCount(2)
  const xSave = await storedMatch(page)
  expect(xSave.match.moves.map(move => move.actor)).toEqual(['human', 'cpu'])
  expect(xSave.match.moves[0].cell).toBe(0)
  expect(xSave.match.moves[1].cell).toBeGreaterThanOrEqual(1)
  expect(xSave.match.moves[1].cell).toBeLessThanOrEqual(8)
  expect(xSave.match.moves[1].provenance).toBe('rng')
  await showHistoryOnMobile(page)
  await page.locator('.ttt-history-entry').last().click()
  await expect(page.getByText(/Random CPU move at/)).toBeVisible()
  await expect(page.getByText(/score|evaluation|centipawn/i)).toHaveCount(0)

  await page.getByRole('button', { name: 'Resign' }).click()
  await page.getByRole('dialog', { name: 'Resign this match?' }).getByRole('button', { name: 'Resign' }).click()
  await page.getByRole('button', { name: 'Rematch' }).click()
  await page.getByRole('button', { name: 'Play as O' }).click()
  await page.getByRole('button', { name: 'Start game' }).click()
  await expect(page.locator('.ttt-history-entry')).toHaveCount(1)
  const oSave = await storedMatch(page)
  expect(oSave.match.humanSymbol).toBe('O')
  expect(oSave.match.moves[0].actor).toBe('cpu')
  expect(oSave.match.moves[0].symbol).toBe('X')
  expect(oSave.match.moves[0].cell).toBeGreaterThanOrEqual(0)
  expect(oSave.match.moves[0].cell).toBeLessThanOrEqual(8)
})

const lossSave = {
  ...validSaves.win,
  match: {
    ...validSaves.win.match,
    id: 'fixture-loss',
    humanSymbol: 'O' as const,
    moves: validSaves.win.match.moves.map(move => ({
      ...move,
      actor: move.symbol === 'O' ? 'human' as const : 'cpu' as const,
      provenance: move.symbol === 'O' ? 'human' as const : 'rng' as const,
    })),
  },
}

for (const [outcome, save] of [
  ['win', validSaves.win],
  ['loss', lossSave],
  ['draw', validSaves.draw],
] as const) {
  test(`B1/B3: saved ${outcome} restores, supports review, and rematches`, async ({ page }) => {
    await seedMatch(page, save)
    await page.goto('')
    await expect(page.getByRole('button', { name: 'Rematch' })).toBeVisible()
    await expect(page.locator('.ttt-history-entry')).toHaveCount(save.match.moves.length)
    await expect(page.getByRole('button', { name: 'Rematch' })).toBeVisible()
    await showHistoryOnMobile(page)
    await page.locator('.ttt-history-entry').first().click()
    await expect(page.getByRole('group', { name: 'Historical Tic Tac Toe board' })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('group', { name: 'Current Tic Tac Toe board' })).toBeVisible()
    await expect(page.getByRole('status').filter({ hasText: outcome === 'win' ? 'Victory' : outcome === 'loss' ? 'Defeat' : 'Draw' })).toBeVisible()
    await page.getByRole('button', { name: 'Rematch' }).click()
    await expect(page.getByRole('heading', { name: 'Choose your side' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Start game' })).toBeEnabled()
  })
}

test('B1: resignation cancel preserves match, confirmation ends it', async ({ page }) => {
  await seedMatch(page, validSaves.humanTurn)
  await page.goto('')
  await page.getByRole('button', { name: 'Resign' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Keep playing' }).click()
  expect((await storedMatch(page)).match.outcome.kind).toBe('ongoing')
  await page.getByRole('button', { name: 'Resign' }).click()
  await page.getByRole('dialog', { name: 'Resign this match?' }).getByRole('button', { name: 'Resign' }).click()
  await expect(page.locator('.pv-board-status')).toHaveText('Defeat')
  expect((await storedMatch(page)).match.outcome.kind).toBe('resignation')
  await page.reload()
  await expect(page.locator('.pv-board-status')).toHaveText('Defeat')
})

test('B1: saved RNG fallback shows its diagnostic without a score table', async ({ page }) => {
  const fallbackSave = {
    ...validSaves.humanTurn,
    match: {
      ...validSaves.humanTurn.match,
      id: 'fixture-fallback',
      moves: validSaves.humanTurn.match.moves.map(move => move.actor === 'cpu'
        ? { ...move, provenance: 'rng-fallback' as const, diagnostic: 'CPU returned three invalid moves; a random legal move was used.' }
        : move),
    },
  }
  await seedMatch(page, fallbackSave)
  await page.goto('')
  await showHistoryOnMobile(page)
  await page.locator('.ttt-history-entry').last().click()
  await expect(page.getByText(/Random fallback at B2\. CPU returned three invalid moves/)).toBeVisible()
  await expect(page.getByText(/score|evaluation|centipawn/i)).toHaveCount(0)
})

test('B2: confirmation preview replaces cells, submits once, and preference survives rematch/reload', async ({ page }) => {
  await page.goto('')
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('checkbox', { name: 'Confirm moves before playing' }).check()
  await page.getByRole('button', { name: 'Start game' }).click()
  await clickCell(page, 'A3')
  await expect(page.getByRole('button', { name: /A3, empty, pending move/ })).toContainText('Pending')
  await expect(page.locator('.ttt-history-entry')).toHaveCount(0)
  await clickCell(page, 'B3')
  await expect(page.getByRole('button', { name: /B3, empty, pending move/ })).toContainText('Pending')
  await expect(page.getByRole('button', { name: /^A3, empty, play here$/ })).toBeVisible()
  await page.getByRole('button', { name: 'Confirm move' }).click()
  await expect(page.locator('.ttt-history-entry')).toHaveCount(2)
  expect((await storedMatch(page)).match.moves[0].cell).toBe(1)
  await expect(page.getByRole('button', { name: 'Confirm move' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Resign' }).click()
  await page.getByRole('dialog', { name: 'Resign this match?' }).getByRole('button', { name: 'Resign' }).click()
  await page.getByRole('button', { name: 'Rematch' }).click()
  await page.getByRole('button', { name: 'Settings' }).click()
  await expect(page.getByRole('checkbox', { name: 'Confirm moves before playing' })).toBeChecked()
  await page.reload()
  await page.getByRole('button', { name: 'Settings' }).click()
  await expect(page.getByRole('checkbox', { name: 'Confirm moves before playing' })).toBeChecked()
})

test('B2/B3: history and occupied-cell inspection stay read-only until return to current', async ({ page }) => {
  await seedMatch(page, validSaves.humanTurn)
  await page.goto('')
  await showHistoryOnMobile(page)
  await page.locator('.ttt-history-entry').last().click()
  await expect(page.locator('.ttt-inspection-title')).toContainText('Reviewing 1o B2')
  await expect(page.getByRole('button', { name: 'Later' })).toBeDisabled()
  await expect(page.getByRole('button', { name: /B3, empty, unavailable/ })).toBeDisabled()
  await page.getByRole('button', { name: 'Earlier' }).click()
  await expect(page.locator('.ttt-inspection-title')).toContainText('Reviewing 1x A3')
  await page.getByRole('button', { name: 'Later' }).click()
  await expect(page.locator('.ttt-inspection-title')).toContainText('Reviewing 1o B2')
  await page.getByRole('button', { name: 'Return to current' }).click()
  await page.getByRole('button', { name: /A3, X, inspect/ }).click()
  await expect(page.locator('.ttt-inspection-title')).toContainText('Reviewing 1x A3')
  await page.reload()
  await expect(page.getByRole('group', { name: 'Current Tic Tac Toe board' })).toBeVisible()
  await expect(page.locator('.ttt-history-entry')).toHaveCount(2)
  expect((await storedMatch(page)).match.moves).toHaveLength(2)
})

test('B3: malformed match offers explicit fresh start', async ({ page }) => {
  await page.addInitScript((key) => localStorage.setItem(key, '{bad-json'), matchKey)
  await page.goto('')
  await expect(page.getByRole('button', { name: 'Start game' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Start fresh' })).toBeVisible()
  await page.getByRole('button', { name: 'Start fresh' }).click()
  await page.getByRole('button', { name: 'Start game' }).click()
  await expect(page.getByRole('group', { name: 'Current Tic Tac Toe board' })).toBeVisible()
})

test('B3: restored CPU turn resumes once and its result survives reload', async ({ page }) => {
  await seedMatch(page, validSaves.cpuTurnAfterTwoInvalid)
  await page.goto('')
  await expect(page.locator('.ttt-history-entry')).toHaveCount(2)
  const afterCpu = await storedMatch(page)
  expect(afterCpu.match.moves[0].cell).toBe(0)
  expect(afterCpu.match.moves[1].actor).toBe('cpu')
  expect(afterCpu.match.moves[1].cell).not.toBe(0)
  expect(afterCpu.recovery.consecutiveInvalid).toBe(0)
  await page.reload()
  await expect(page.locator('.ttt-history-entry')).toHaveCount(2)
  expect((await storedMatch(page)).match.moves).toEqual(afterCpu.match.moves)
})

test('B3: quota failure keeps current play available with a persistent notice', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Storage.prototype, 'setItem', {
      configurable: true,
      value: () => { throw new DOMException('quota reached', 'QuotaExceededError') },
    })
  })
  await page.goto('')
  await page.getByRole('button', { name: 'Start game' }).click()
  await expect(page.locator('.pv-notice')).toBeVisible()
  await clickCell(page, 'A3')
  await expect(page.locator('.ttt-history-entry')).toHaveCount(2)
  await expect(page.locator('.pv-notice')).toBeVisible()
})

test('B3: blocked storage shows notice and allows in-memory play', async ({ page }) => {
  await page.addInitScript(() => {
    for (const method of ['getItem', 'setItem', 'removeItem'] as const) {
      Object.defineProperty(Storage.prototype, method, { configurable: true, value: () => { throw new DOMException('blocked', 'SecurityError') } })
    }
  })
  await page.goto('')
  await expect(page.locator('.pv-notice')).toBeVisible()
  await page.getByRole('button', { name: 'Start game' }).click()
  await clickCell(page, 'A3')
  await expect(page.locator('.ttt-history-entry')).toHaveCount(2)
  await expect(page.locator('.pv-notice')).toBeVisible()
})
