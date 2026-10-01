import { expect, test } from '@playwright/test'

test.use({ trace: 'off', video: 'off' })

test.describe('visitor runtime through both games', () => {
  test.skip(!process.env.JEV_E2E_FAKE_RELAY, 'Requires a build with a synthetic local Supabase URL and mocked relay.')
  for (const game of ['tic-tac-toe', 'connect-four'] as const) {
    test(`${game} uses the visitor route, saves analysis, and waits for a key after reload`, async ({ page }) => {
      const requests: Array<{ gameId: string; state: { colors?: { one: string; two: string } }; legalMoveIds: string[] }> = []
      await page.route('**/functions/v1/jev-visitor', async route => {
        const body = route.request().postDataJSON()
        expect(body.visitorKey).toBe('synthetic-test-key')
        requests.push({ gameId: body.gameId, state: body.state, legalMoveIds: body.legalMoveIds })
        const probabilities = Object.fromEntries(body.legalMoveIds.map((id: string, index: number) => [id, index === 0 ? 1 : 0]))
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
          protocolVersion: body.protocolVersion, gameId: body.gameId, matchId: body.matchId,
          expectedPly: body.expectedPly, attemptId: body.attemptId, status: 'success',
          choice: body.legalMoveIds[0], confidence: 0.742, probabilities, resolvedModelId: 'synthetic-model',
        }) })
      })
      await page.goto('')
      await page.getByRole('textbox', { name: 'TypeSafe API key' }).fill('synthetic-test-key')
      await page.getByRole('button', { name: 'Save', exact: true }).click()
      if (game === 'tic-tac-toe') await page.getByRole('button', { name: 'Play as O' }).click()
      else {
        await page.getByRole('button', { name: 'Connect Four' }).click()
        await page.getByRole('button', { name: 'Play as red' }).click()
        await page.getByRole('button', { name: 'Play second' }).click()
      }
      await page.getByRole('button', { name: 'Start game' }).click()
      await expect(page.locator('.pv-history-entry')).toHaveCount(1)
      expect(requests).toHaveLength(1)
      expect(requests[0].gameId).toBe(game)
      if (game === 'connect-four') expect(requests[0].state.colors).toEqual({ one: 'yellow', two: 'red' })
      const saved = await page.evaluate(() => JSON.stringify(localStorage))
      expect(saved).not.toContain('synthetic-test-key')
      const toggle = page.getByRole('button', { name: 'Show history' })
      if (await toggle.isVisible()) await toggle.click()
      await page.locator('.pv-history-entry').first().click()
      await expect(page.getByText('Confidence 0.742', { exact: true })).toBeVisible()
      await page.reload()
      await expect(page.locator('.pv-history-entry')).toHaveCount(1)
      await expect(page.getByText('No key saved. New matches use RNG.')).toBeVisible()
      await page.locator('.pv-history-entry').first().click()
      await expect(page.getByText('Confidence 0.742', { exact: true })).toBeVisible()
      await page.getByRole('button', { name: 'Return to current' }).click()
      if (game === 'tic-tac-toe') await page.getByRole('button', { name: 'B3, empty, play here' }).click()
      else await page.getByRole('button', { name: 'B1, empty' }).click()
      await expect(page.getByText('Waiting for TypeSafe key', { exact: true })).toBeVisible()
      expect(requests).toHaveLength(1)
      await page.getByRole('textbox', { name: 'TypeSafe API key' }).fill('synthetic-test-key')
      await page.getByRole('button', { name: 'Save', exact: true }).click()
      await expect(page.locator('.pv-history-entry')).toHaveCount(3)
      expect(requests).toHaveLength(2)
    })
  }
})

test('adding a key during an RNG match leaves its assignment and moves on RNG', async ({ page }) => {
  let calls = 0
  await page.route('**/functions/v1/jev-visitor', route => { calls++; return route.abort() })
  await page.goto('')
  await page.getByRole('button', { name: 'Start game' }).click()
  await expect(page.getByText('Opponent: RNG')).toBeVisible()
  await page.getByRole('textbox', { name: 'TypeSafe API key' }).fill('synthetic-late-key')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await page.getByRole('button', { name: 'A3, empty, play here' }).click()
  await expect(page.locator('.pv-history-entry')).toHaveCount(2)
  await expect(page.getByText('Opponent: RNG')).toBeVisible()
  expect(calls).toBe(0)
  const saved = await page.evaluate(() => JSON.stringify(localStorage))
  expect(saved).not.toContain('synthetic-late-key')
  const match = await page.evaluate(() => JSON.parse(localStorage.getItem('pvjev:v0.5:match:tic-tac-toe')!))
  expect(match.match.assignment).toEqual({ opponent: 'rng' })
})

test('a rejected visitor key can be replaced and manually retried on the same Jev match', async ({ page }) => {
  const keys: string[] = []
  await page.route('**/functions/v1/jev-visitor', async route => {
    const body = route.request().postDataJSON()
    keys.push(body.visitorKey)
    const identity = { protocolVersion: body.protocolVersion, gameId: body.gameId,
      matchId: body.matchId, expectedPly: body.expectedPly, attemptId: body.attemptId }
    if (keys.length === 1) {
      await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({
        ...identity, status: 'error', code: 'authentication', message: 'The TypeSafe key was rejected.',
      }) })
    } else {
      const probabilities = Object.fromEntries(body.legalMoveIds.map((id: string, index: number) => [id, index === 0 ? 1 : 0]))
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        ...identity, status: 'success', choice: body.legalMoveIds[0], confidence: 0.742,
        probabilities, resolvedModelId: 'synthetic-model',
      }) })
    }
  })
  await page.goto('')
  await page.getByRole('textbox', { name: 'TypeSafe API key' }).fill('synthetic-bad-key')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await page.getByRole('button', { name: 'Play as O' }).click()
  await page.getByRole('button', { name: 'Start game' }).click()
  await expect(page.getByRole('button', { name: 'Retry CPU move' })).toBeVisible()
  await expect(page.getByText('Opponent: Jev')).toBeVisible()
  expect(keys).toEqual(['synthetic-bad-key'])
  await page.getByRole('textbox', { name: 'TypeSafe API key' }).fill('synthetic-corrected-key')
  await page.getByRole('button', { name: 'Replace', exact: true }).click()
  expect(keys).toHaveLength(1)
  await page.getByRole('button', { name: 'Retry CPU move' }).click()
  await expect(page.locator('.pv-history-entry')).toHaveCount(1)
  expect(keys).toEqual(['synthetic-bad-key', 'synthetic-corrected-key'])
  const saved = await page.evaluate(() => JSON.stringify(localStorage))
  expect(saved).not.toContain('synthetic-bad-key')
  expect(saved).not.toContain('synthetic-corrected-key')
})

for (const humanColor of ['red', 'yellow'] as const) {
  for (const humanOrder of ['first', 'second'] as const) {
    test(`Connect Four ${humanColor}/${humanOrder} sends CPU side and colors correctly`, async ({ page }) => {
      const requests: Array<{ state: { cpuSide: string; colors: { one: string; two: string } } }> = []
      await page.route('**/functions/v1/jev-visitor', async route => {
        const body = route.request().postDataJSON()
        requests.push(body)
        const probabilities = Object.fromEntries(body.legalMoveIds.map((id: string, index: number) => [id, index === 0 ? 1 : 0]))
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
          protocolVersion: body.protocolVersion, gameId: body.gameId, matchId: body.matchId,
          expectedPly: body.expectedPly, attemptId: body.attemptId, status: 'success',
          choice: body.legalMoveIds[0], confidence: 0.742, probabilities, resolvedModelId: 'synthetic-model',
        }) })
      })
      await page.goto('')
      await page.getByRole('textbox', { name: 'TypeSafe API key' }).fill('synthetic-test-key')
      await page.getByRole('button', { name: 'Save', exact: true }).click()
      await page.getByRole('button', { name: 'Connect Four' }).click()
      await page.getByRole('button', { name: `Play as ${humanColor}` }).click()
      await page.getByRole('button', { name: `Play ${humanOrder}` }).click()
      await page.getByRole('button', { name: 'Start game' }).click()
      if (humanOrder === 'first') await page.getByRole('button', { name: 'A1, empty' }).click()
      await expect(page.locator('.pv-history-entry')).toHaveCount(humanOrder === 'first' ? 2 : 1)
      expect(requests).toHaveLength(1)
      expect(requests[0].state.cpuSide).toBe(humanOrder === 'first' ? 'two' : 'one')
      expect(requests[0].state.colors).toEqual(humanOrder === 'first'
        ? { one: humanColor, two: humanColor === 'red' ? 'yellow' : 'red' }
        : { one: humanColor === 'red' ? 'yellow' : 'red', two: humanColor })
    })
  }
}

test('three visitor service failures require manual retries then save RNG fallback under Jev', async ({ page }) => {
  let calls = 0
  await page.route('**/functions/v1/jev-visitor', async route => {
    calls++
    const body = route.request().postDataJSON()
    await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({
      protocolVersion: body.protocolVersion, gameId: body.gameId, matchId: body.matchId,
      expectedPly: body.expectedPly, attemptId: body.attemptId, status: 'error',
      code: 'service', message: 'The Jev service could not complete this move.',
    }) })
  })
  await page.goto('')
  await page.getByRole('textbox', { name: 'TypeSafe API key' }).fill('synthetic-test-key')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await page.getByRole('button', { name: 'Play as O' }).click()
  await page.getByRole('button', { name: 'Start game' }).click()
  for (let attempt = 1; attempt <= 2; attempt++) {
    await expect(page.getByRole('button', { name: 'Retry CPU move' })).toBeVisible()
    expect(calls).toBe(attempt)
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('pvjev:v0.5:match:tic-tac-toe')!).recovery.consecutiveServiceFailures)).toBe(attempt)
    await page.getByRole('button', { name: 'Retry CPU move' }).click()
  }
  await expect(page.locator('.pv-history-entry')).toHaveCount(1)
  expect(calls).toBe(3)
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('pvjev:v0.5:match:tic-tac-toe')!))
  expect(saved.match.assignment).toEqual({ opponent: 'jev', credentialRoute: 'visitor' })
  expect(saved.match.moves[0].provenance).toBe('rng-fallback')
  expect(saved.match.moves[0].diagnostic).toBe('Jev service failed three times; fell back to random move')
  expect(saved.recovery.consecutiveServiceFailures).toBe(0)
  expect(saved.recovery.consecutiveInvalid).toBe(0)
})

test('mobile saved analysis can be reviewed while offline', async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.route('**/functions/v1/jev-visitor', async route => {
    const body = route.request().postDataJSON()
    const probabilities = Object.fromEntries(body.legalMoveIds.map((id: string, index: number) => [id, index === 0 ? 1 : 0]))
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      protocolVersion: body.protocolVersion, gameId: body.gameId, matchId: body.matchId,
      expectedPly: body.expectedPly, attemptId: body.attemptId, status: 'success',
      choice: body.legalMoveIds[0], confidence: 0.742, probabilities, resolvedModelId: 'synthetic-model',
    }) })
  })
  await page.goto('')
  await page.getByRole('textbox', { name: 'TypeSafe API key' }).fill('synthetic-test-key')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await page.getByRole('button', { name: 'Play as O' }).click()
  await page.getByRole('button', { name: 'Start game' }).click()
  await expect(page.locator('.pv-history-entry')).toHaveCount(1)
  await context.setOffline(true)
  await page.getByRole('button', { name: 'Show history' }).click()
  await page.locator('.pv-history-entry').first().click()
  await expect(page.getByText('Confidence 0.742', { exact: true })).toBeVisible()
  await expect(page.getByText('Choice probability 1.000', { exact: true })).toBeVisible()
  await context.setOffline(false)
})
