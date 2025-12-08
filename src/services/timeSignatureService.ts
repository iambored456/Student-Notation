// js/services/timeSignatureService.ts

interface TimeSignatureOption {
  label: string;
  groupings: number[];
  description: string;
}

type TimeSignatureOptionsMap = Record<string, TimeSignatureOption[]>;

const TimeSignatureService = {
  getTimeSignatureOptions(): TimeSignatureOptionsMap {
    return {
      'Single Macrobeat': [
        { label: '1/4', groupings: [2], description: 'one 2-beat' },
        { label: '2/8', groupings: [2], description: 'one 2-beat' },
        { label: '3/8', groupings: [3], description: 'one 3-beat' }
      ],
      'Two Macrobeats': [
        { label: '2/4', groupings: [2, 2], description: 'two 2-beats' },
        { label: '4/8', groupings: [2, 2], description: 'two 2-beats' },
        { label: '5/8', groupings: [2, 3], description: '2+3' },
        { label: '5/8', groupings: [3, 2], description: '3+2' },
        { label: '6/8', groupings: [3, 3], description: 'two 3-beats' }
      ],
      'Three Macrobeats': [
        { label: '3/4', groupings: [2, 2, 2], description: 'three 2-beats' },
        { label: '7/8', groupings: [2, 2, 3], description: '2+2+3' },
        { label: '7/8', groupings: [3, 2, 2], description: '3+2+2' },
        { label: '7/8', groupings: [2, 3, 2], description: '2+3+2' },
        { label: '8/8', groupings: [3, 3, 2], description: '3+3+2' },
        { label: '8/8', groupings: [3, 2, 3], description: '3+2+3' },
        { label: '8/8', groupings: [2, 3, 3], description: '2+3+3' },
        { label: '9/8', groupings: [3, 3, 3], description: 'three 3-beats' }
      ],
      'Four Macrobeats': [
        { label: '4/4', groupings: [2, 2, 2, 2], description: 'four 2-beats' },
        { label: '10/8', groupings: [2, 2, 3, 3], description: '2+2+3+3' },
        { label: '10/8', groupings: [2, 3, 2, 3], description: '2+3+2+3' },
        { label: '10/8', groupings: [2, 3, 3, 2], description: '2+3+3+2' },
        { label: '10/8', groupings: [3, 2, 3, 2], description: '3+2+3+2' },
        { label: '10/8', groupings: [3, 3, 2, 2], description: '3+3+2+2' },
        { label: '10/8', groupings: [3, 2, 2, 3], description: '3+2+2+3' },
        { label: '11/8', groupings: [3, 3, 3, 2], description: '3+3+3+2' },
        { label: '11/8', groupings: [3, 3, 2, 3], description: '3+3+2+3' },
        { label: '11/8', groupings: [3, 2, 3, 3], description: '3+2+3+3' },
        { label: '11/8', groupings: [2, 3, 3, 3], description: '2+3+3+3' },
        { label: '12/8', groupings: [3, 3, 3, 3], description: 'four 3-beats' }
      ],
      'Five Macrobeats': [
        { label: '5/4', groupings: [2, 2, 2, 2, 2], description: 'five 2-beats' },
        { label: '11/8', groupings: [2, 2, 2, 2, 3], description: '2+2+2+2+3' },
        { label: '11/8', groupings: [2, 2, 2, 3, 2], description: '2+2+2+3+2' },
        { label: '11/8', groupings: [2, 2, 3, 2, 2], description: '2+2+3+2+2' },
        { label: '11/8', groupings: [2, 3, 2, 2, 2], description: '2+3+2+2+2' },
        { label: '11/8', groupings: [3, 2, 2, 2, 2], description: '3+2+2+2+2' },
        { label: '12/8', groupings: [2, 2, 2, 3, 3], description: '2+2+2+3+3' },
        { label: '12/8', groupings: [2, 2, 3, 2, 3], description: '2+2+3+2+3' },
        { label: '12/8', groupings: [2, 2, 3, 3, 2], description: '2+2+3+3+2' },
        { label: '12/8', groupings: [2, 3, 2, 2, 3], description: '2+3+2+2+3' },
        { label: '12/8', groupings: [2, 3, 2, 3, 2], description: '2+3+2+3+2' },
        { label: '12/8', groupings: [2, 3, 3, 2, 2], description: '2+3+3+2+2' },
        { label: '12/8', groupings: [3, 2, 2, 2, 3], description: '3+2+2+2+3' },
        { label: '12/8', groupings: [3, 2, 2, 3, 2], description: '3+2+2+3+2' },
        { label: '12/8', groupings: [3, 2, 3, 2, 2], description: '3+2+3+2+2' },
        { label: '12/8', groupings: [3, 3, 2, 2, 2], description: '3+3+2+2+2' },
        { label: '13/8', groupings: [3, 2, 2, 3, 3], description: '3+2+2+3+3' },
        { label: '13/8', groupings: [3, 3, 2, 3, 2], description: '3+3+2+3+2' },
        { label: '13/8', groupings: [3, 3, 3, 2, 2], description: '3+3+3+2+2' },
        { label: '15/8', groupings: [3, 3, 3, 3, 3], description: 'five 3-beats' }
      ]
    };
  },

  generateDropdownHTML(): string {
    const options = this.getTimeSignatureOptions();
    let html = '<div id="time-signature-dropdown" class="time-signature-dropdown hidden">';

    Object.entries(options).forEach(([category, signatures]) => {
      html += '<div class="dropdown-category">';
      html += `<div class="dropdown-category-header">${category}</div>`;
      signatures.forEach((signature, index) => {
        const uniqueKey = `${category}-${index}`;
        html += `<div class="dropdown-option" data-groupings="${JSON.stringify(signature.groupings)}" data-key="${uniqueKey}">`;
        html += `<span class="dropdown-label">${signature.label}</span>`;
        html += `<span class="dropdown-description">${signature.description}</span>`;
        html += '</div>';
      });
      html += '</div>';
    });

    html += '</div>';
    return html;
  },

  getTimeSignatureLabel(groupings: number[]): string {
    const total = groupings.reduce((sum, value) => sum + value, 0);
    const hasThreeGrouping = groupings.includes(3);
    return hasThreeGrouping ? `${total}/8` : `${total / 2}/4`;
  }
};

export default TimeSignatureService;
