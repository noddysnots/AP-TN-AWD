/** Accessible multi-select highlight palette (order of selection) */
export const SELECTION_PALETTE = [
  '#E53935',
  '#8E24AA',
  '#1E88E5',
  '#00897B',
  '#F4511E',
  '#6D4C41',
] as const

export function selectionColorAtIndex(index: number): string {
  return SELECTION_PALETTE[index % SELECTION_PALETTE.length]
}
