// Debug script to log tempo slider container heights
const slider = document.querySelector('#tempo-slider');
if (!slider) {
    console.error('Tempo slider not found!');
} else {
    console.log('=== TEMPO SLIDER HEIGHT CHAIN ===');

    let element = slider;
    let depth = 0;

    while (element && depth < 15) {
        const computed = window.getComputedStyle(element);
        const height = element.offsetHeight;
        const computedHeight = computed.height;
        const maxHeight = computed.maxHeight;
        const minHeight = computed.minHeight;
        const flex = computed.flex;
        const display = computed.display;

        const tag = element.tagName.toLowerCase();
        const id = element.id ? `#${element.id}` : '';
        const classes = element.className ? `.${element.className.split(' ').join('.')}` : '';
        const selector = `${tag}${id}${classes}`;

        console.log(`${depth}: ${selector}`);
        console.log(`   Actual: ${height}px | Computed: ${computedHeight} | Max: ${maxHeight} | Min: ${minHeight}`);
        console.log(`   Display: ${display} | Flex: ${flex}`);

        element = element.parentElement;
        depth++;
    }

    console.log('\n=== TOOLBAR HEIGHT ===');
    const toolbar = document.querySelector('#toolbar');
    if (toolbar) {
        const computed = window.getComputedStyle(toolbar);
        console.log(`Toolbar actual: ${toolbar.offsetHeight}px`);
        console.log(`Toolbar computed: ${computed.height}`);
        console.log(`Toolbar min-height: ${computed.minHeight}`);
    }

    console.log('\n=== RHYTHM TAB CONTENT HEIGHT ===');
    const rhythmContent = document.querySelector('.rhythm-tab-content');
    if (rhythmContent) {
        const computed = window.getComputedStyle(rhythmContent);
        console.log(`Rhythm tab content actual: ${rhythmContent.offsetHeight}px`);
        console.log(`Rhythm tab content computed: ${computed.height}`);
        console.log(`Rhythm tab content flex: ${computed.flex}`);
    }
}
