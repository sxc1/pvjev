import { expect, test, type Page } from '@playwright/test'

async function openHumanFirst(page: Page) {
  await page.addInitScript(() => { Math.random = () => 0 })
  await page.goto('')
  await page.getByRole('button', { name: 'Connect Four' }).click()
  await page.getByRole('button', { name: 'Start game' }).click()
}

test.describe('Connect Four pointer and confirmation', () => {
  test.skip(({ browserName, isMobile }) => browserName !== 'chromium' || isMobile, 'Mouse gestures run once on desktop Chromium')

  test('uses release column, shows held preview, and cancels an outside release', async ({ page }) => {
    await openHumanFirst(page)
    const board = page.getByRole('group', { name: 'Current Connect Four board' })
    const box = (await board.boundingBox())!
    const cellX = (column: number) => box.x + box.width * (column + .5) / 7
    const y = box.y + box.height / 2
    await page.mouse.move(cellX(0), y)
    await page.mouse.down()
    await expect(page.getByRole('button', { name: 'A1, pending red' })).toBeVisible()
    await page.mouse.move(cellX(2), y, { steps: 4 })
    await expect(page.getByRole('button', { name: 'C1, pending red' })).toBeVisible()
    await page.mouse.up()
    await expect(page.getByRole('button', { name: 'C1, red' })).toBeVisible()
    await expect(page.locator('.pv-history-entry')).toHaveCount(2)
    const count = await page.locator('.pv-history-entry').count()
    await page.mouse.move(cellX(1), y)
    await page.mouse.down()
    await page.mouse.move(box.x - 10, y)
    await page.mouse.up()
    await expect(page.locator('.pv-history-entry')).toHaveCount(count)
    await expect(page.getByRole('button', { name: 'B1, empty' })).toBeVisible()
  })

  test('requires confirmation, clears pending on review and setting change, and respects reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await openHumanFirst(page)
    await page.getByRole('button', { name: 'Settings' }).click()
    await page.getByRole('checkbox', { name: 'Confirm moves before playing' }).check()
    await page.getByRole('button', { name: 'Settings' }).click()
    await page.getByRole('button', { name: 'B1, empty' }).click()
    await expect(page.getByRole('button', { name: 'Confirm move' })).toBeVisible()
    await expect(page.locator('.pv-history-entry')).toHaveCount(0)
    expect(await page.locator('.cf-piece-pending').evaluate(element => getComputedStyle(element).animationName)).toBe('none')
    await page.getByRole('button', { name: 'Review moves' }).click()
    await expect(page.getByRole('button', { name: 'Confirm move' })).toBeHidden()
    await expect(page.getByRole('group', { name: 'Historical Connect Four board' })).toBeVisible()
    await page.getByRole('button', { name: 'Return to current' }).click()
    await page.getByRole('button', { name: 'C1, empty' }).click()
    await expect(page.getByRole('button', { name: 'Confirm move' })).toBeVisible()
    await page.getByRole('button', { name: 'Settings' }).click()
    await page.getByRole('checkbox', { name: 'Confirm moves before playing' }).uncheck()
    await expect(page.getByRole('button', { name: 'Confirm move' })).toBeHidden()
    await page.getByRole('button', { name: 'Settings' }).click()
    await page.getByRole('button', { name: 'C1, empty' }).click()
    await expect(page.getByRole('button', { name: 'C1, red' })).toBeVisible()
    await expect(page.locator('.pv-history-entry')).toHaveCount(2)
  })

  test('full starting column can drag to a legal destination, and pointer cancellation makes no move', async ({ page }) => {
    await openHumanFirst(page)
    for (let turn = 1; turn <= 3; turn++) {
      await page.getByRole('button', { name: `A${turn * 2 - 1}, empty` }).click()
      await expect(page.getByRole('button', { name: `A${turn * 2}, yellow` })).toBeVisible()
    }
    const board = page.getByRole('group', { name: 'Current Connect Four board' })
    const box = (await board.boundingBox())!
    const x = (column: number) => box.x + box.width * (column + .5) / 7
    const y = box.y + box.height / 2
    const count = await page.locator('.pv-history-entry').count()
    await page.mouse.move(x(0), y)
    await page.mouse.down()
    await page.mouse.up()
    await expect(page.locator('.pv-history-entry')).toHaveCount(count)
    await page.mouse.move(x(0), y)
    await page.mouse.down()
    await page.mouse.move(x(2), y)
    await page.mouse.up()
    await expect(page.getByRole('button', { name: 'C1, red' })).toBeVisible()
    await expect(page.locator('.pv-history-entry')).toHaveCount(count + 2)
    const after = count + 2
    await page.mouse.move(x(3), y)
    await page.mouse.down()
    await board.dispatchEvent('pointercancel', { pointerId: 1, pointerType: 'mouse', isPrimary: true })
    await page.mouse.up()
    await expect(page.locator('.pv-history-entry')).toHaveCount(after)
  })
})
