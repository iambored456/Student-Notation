// js/harmony/models/rules.js

export const rules = {
  // which menu items to render
  qualities: ["maj", "min", "aug", "dim", "dom"],

  inversion: {
    triad: [0, 1, 2],
    tetrad: [0, 1, 2, 3]
  },

  extensionByQuality: {
    maj: ["", "7", "9", "11", "#11", "13", "add6", "sus2", "sus4"],
    min: ["", "7", "9", "11", "13", "add6", "sus2"],
    aug: ["", "7", "9", "#11", "b13"],
    dim: ["", "7"], // Allows for dim and dim7
    dom: ["7", "9", "b9", "#9", "11", "#11", "13", "b13", "sus2", "sus4"]
  },

  susConflicts: {
    "sus2": ["9", "b9", "#9"],
    "sus4": ["11", "b11", "#11"]
  }
};

// Use Object.freeze to prevent accidental mutation, mimicking `as const` from TypeScript.
Object.freeze(rules);
Object.freeze(rules.inversion);
Object.freeze(rules.extensionByQuality);
Object.freeze(rules.susConflicts);