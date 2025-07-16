
// Test mobile auto-save efficiency
const testData = { gigType: 'test', eventName: 'test event' };
const key = 'efficiency-test';

// Test 1: Storage speed
console.time('Storage Speed');
localStorage.setItem(`autosave_${key}`, JSON.stringify(testData));
localStorage.setItem(`autosave_${key}_timestamp`, Date.now().toString());
console.timeEnd('Storage Speed');

// Test 2: Retrieval speed
console.time('Retrieval Speed');
const data = localStorage.getItem(`autosave_${key}`);
const timestamp = localStorage.getItem(`autosave_${key}_timestamp`);
console.timeEnd('Retrieval Speed');

// Test 3: Multiple storage efficiency
console.time('Multi-Storage');
const serialized = JSON.stringify(testData);
localStorage.setItem(`autosave_${key}`, serialized);
localStorage.setItem(`backup_autosave_${key}`, serialized);
sessionStorage.setItem(`session_autosave_${key}`, serialized);
console.timeEnd('Multi-Storage');

console.log('Data integrity check:', JSON.parse(data || '{}').gigType === 'test');
console.log('Storage size:', new Blob([serialized]).size, 'bytes');

