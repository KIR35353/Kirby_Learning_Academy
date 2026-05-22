import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

const errors = [];
page.on('pageerror', e => errors.push('PAGE ERROR: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE ERROR: ' + m.text()); });

const url = 'http://localhost:9000/kirby-learning-academy-dev/courses/cmph9iqnb000070l4bdt7l8uz/v1/EXAM_Final.html';
console.log('Loading:', url);
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(500);

// Check audio gate
const gateVisible = await page.locator('#audioGate').isVisible();
console.log('Audio gate visible:', gateVisible);

// Click Begin Final Exam
await page.locator('#audioGateBtn').click();
await page.waitForTimeout(600); // wait for transition

// Check if gate is gone
const gateExists = await page.locator('#audioGate').count();
console.log('Audio gate still in DOM:', gateExists);

// Check instruction screen
const instrVisible = await page.locator('#s-instr').isVisible();
console.log('Instruction screen visible:', instrVisible);
console.log('s-instr classes:', await page.locator('#s-instr').getAttribute('class'));

// Click Start Exam
await page.locator('#btnStart').click();
await page.waitForTimeout(600);

// Check q-0
const q0Exists = await page.locator('#q-0').count();
const q0Visible = q0Exists > 0 ? await page.locator('#q-0').isVisible() : false;
console.log('q-0 exists:', q0Exists, 'visible:', q0Visible);
console.log('q-0 classes:', q0Exists > 0 ? await page.locator('#q-0').getAttribute('class') : 'N/A');

console.log('Errors:', errors.length ? errors : 'none');

await browser.close();
