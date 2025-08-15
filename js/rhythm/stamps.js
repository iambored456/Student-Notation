// js/rhythm/stamps.js
// Slots 0..3 correspond to 1 e & a within ONE 2-microbeat cell

export const SIXTEENTH_STAMPS = [
  { id: 1,  diamonds: [0],       ovals: [],       label: "left 8th" },
  { id: 2,  diamonds: [1],       ovals: [],       label: "e" },
  { id: 3,  diamonds: [2],       ovals: [],       label: "right 8th" },
  { id: 4,  diamonds: [3],       ovals: [],       label: "a" },
  { id: 5,  diamonds: [0, 1],    ovals: [],       label: "1 e" },
  { id: 6,  diamonds: [1, 2],    ovals: [],       label: "e &" },
  { id: 7,  diamonds: [2, 3],    ovals: [],       label: "& a" },
  { id: 8,  diamonds: [0, 2],    ovals: [],       label: "two 8ths" },
  { id: 9,  diamonds: [1, 3],    ovals: [],       label: "e a" },
  { id: 10, diamonds: [0, 1, 2], ovals: [],       label: "1 e + right 8th" },
  { id: 11, diamonds: [1, 2, 3], ovals: [],       label: "e & a" },
  { id: 12, diamonds: [0, 1, 3], ovals: [],       label: "1 e a" },
  { id: 13, diamonds: [0, 2, 3], ovals: [],       label: "left 8th + & a" },
  { id: 14, diamonds: [0, 3],    ovals: [],       label: "left 8th + a" },
  { id: 15, diamonds: [0, 1, 2, 3], ovals: [],    label: "1 e & a" },
];

export function getStampById(id) {
  return SIXTEENTH_STAMPS.find(stamp => stamp.id === id);
}