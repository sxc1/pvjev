import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { JevAnalysis, JEV_TIE_CAUTION } from './JevAnalysis'

describe('saved Jev analysis', () => {
  it('formats retained precision, labels probabilities, and exposes a focusable tie caution', () => {
    const html = renderToStaticMarkup(<JevAnalysis analysis={{
      confidence: 0.74212,
      choices: [{ moveId: 'cell-1', probability: 0.4996 }, { moveId: 'cell-2', probability: 0.4996 }],
      tie: { count: 2, selectedMoveId: 'cell-1' }, resolvedModelId: 'model-internal',
    }} moveLabel={id => id} />)
    expect(html).toContain('Confidence 0.742')
    expect(html).toContain('Choice probability 0.500')
    expect(html).toContain(JEV_TIE_CAUTION)
    expect(html).toContain('tabindex="0"')
    expect(html).toContain('not win probabilities')
    expect(html).not.toContain('model-internal')
  })
})
