// js/rhythm/triplets.js
// A triplet group holds three equally spaced partials inside one group span.

// Build the 7 non-empty patterns for a given span
function stampsForSpan(span, baseId, prefix) {
  return [
    { id: baseId + 0, span, hits: [0],       label: `${prefix} [1]` },
    { id: baseId + 1, span, hits: [1],       label: `${prefix} [2]` },
    { id: baseId + 2, span, hits: [2],       label: `${prefix} [3]` },
    { id: baseId + 3, span, hits: [0, 1],    label: `${prefix} [1 2]` },
    { id: baseId + 4, span, hits: [1, 2],    label: `${prefix} [2 3]` },
    { id: baseId + 5, span, hits: [0, 2],    label: `${prefix} [1 3]` },
    { id: baseId + 6, span, hits: [0, 1, 2], label: `${prefix} [1 2 3]` }
  ];
}

export const TRIPLET_STAMPS = [
  ...stampsForSpan('eighth',  1, '8th triplet'),
  ...stampsForSpan('quarter', 8, 'Quarter triplet')
];

// One timeline "cell" = 2 microbeats (your existing sixteenth-stamp cell width).
export const MICROBEATS_PER_CELL = 2;

// For triplets:
export const GROUP_WIDTH_CELLS = {
  eighth: 1,   // 2 microbeats
  quarter: 2  // 4 microbeats
};

// Normalized X centers across a group width: 1/6, 3/6, 5/6
export const tripletCenterPercents = [16.6667, 50, 83.3333]; // %

export function getTripletStampById(id) {
  return TRIPLET_STAMPS.find(stamp => stamp.id === id);
}
