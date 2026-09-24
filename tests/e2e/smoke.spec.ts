import { expect, test } from '@playwright/test'

test('serves the production build at the configured base path', async ({ page }) => {
  const response = await page.goto('')
  expect(response?.status()).toBe(200)
  await expect(page.locator('#root')).toBeVisible()
  await expect(page.locator('link[rel="stylesheet"]')).toHaveCount(1)
})
