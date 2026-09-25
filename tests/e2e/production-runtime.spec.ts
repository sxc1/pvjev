import { expect, test, type Page } from '@playwright/test'
import { MATCH_STORAGE_KEY } from '../../src/contracts/persistence'
import { validSaves } from '../fixtures/v05'

function watchProductionRuntime(page: Page) {
  const consoleErrors: string[] = []
  const failedResponses: string[] = []
  const unexpectedRequests: string[] = []
  const assets: string[] = []

  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('pageerror', error => consoleErrors.push(error.message))
  page.on('response', response => {
    if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`)
    if (/\.(?:js|css)(?:\?|$)/.test(response.url())) assets.push(response.url())
  })
  page.on('request', request => {
    const url = new URL(request.url())
    if (url.origin !== 'http://127.0.0.1:4173' ||
      (url.pathname !== '/pvjev/' && !url.pathname.startsWith('/pvjev/assets/') &&
        !['/pvjev/sxc1-logo.png', '/pvjev/tictactoe-x.svg', '/pvjev/tictactoe-o.svg'].includes(url.pathname))) {
      unexpectedRequests.push(request.url())
    }
  })

  return () => {
    expect(consoleErrors, 'Browser console and page errors').toEqual([])
    expect(failedResponses, 'Failed runtime or asset responses').toEqual([])
    expect(unexpectedRequests, 'Backend or Jev requests').toEqual([])
    expect(assets.some(url => url.includes('/pvjev/assets/') && url.includes('.js'))).toBe(true)
    expect(assets.some(url => url.includes('/pvjev/assets/') && url.includes('.css'))).toBe(true)
  }
}

test('B6 clean production visit loads assets without backend calls or mock controls', async ({ page }) => {
  const assertRuntime = watchProductionRuntime(page)
  const response = await page.goto('')
  expect(response?.status()).toBe(200)
  expect(page.url()).toBe('http://127.0.0.1:4173/pvjev/')
  await expect(page.getByRole('heading', { name: 'Choose your side' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Start game' })).toBeEnabled()
  await expect(page.getByRole('button', { name: /mock|analysis|evaluation|score table/i })).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Choose your side' })).toBeVisible()
  assertRuntime()
})

test('B6 valid saved match restores after production reload', async ({ page }) => {
  await page.addInitScript(({ key, saved }) => {
    localStorage.setItem(key, JSON.stringify(saved))
  }, { key: MATCH_STORAGE_KEY, saved: validSaves.humanTurn })
  const assertRuntime = watchProductionRuntime(page)
  const response = await page.goto('')
  expect(response?.status()).toBe(200)
  await expect(page.getByRole('group', { name: 'Current Tic Tac Toe board' })).toBeVisible()
  await expect(page.locator('.pv-history-entry')).toHaveCount(2)
  await expect(page.getByRole('button', { name: /A3, X/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /B2, O/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /mock|analysis|evaluation|score table/i })).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('group', { name: 'Current Tic Tac Toe board' })).toBeVisible()
  await expect(page.locator('.pv-history-entry')).toHaveCount(2)
  await expect(page.locator('.pv-board-status')).toHaveText('Your turn')
  assertRuntime()
})
