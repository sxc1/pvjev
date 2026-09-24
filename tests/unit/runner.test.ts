import { expect, test } from 'vitest'

test('runs TypeScript assertions', () => {
  const cells = Array.from({ length: 9 }, (_, index) => index)
  expect(cells).toHaveLength(9)
  expect(cells.at(-1)).toBe(8)
})
