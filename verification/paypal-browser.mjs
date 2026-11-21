// Local browser contract tests. Provider/API responses are intercepted, not real payments.
import { chromium } from '/home/metaphysicist/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = readFileSync('src/lib/paid-plan-content.ts', 'utf8');
const exports = {};
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports, require: (name) => { assert.equal(name, 'server-only'); return {}; } });
const plan = exports.paidPlanContent;
const base = 'http://127.0.0.1:3087';
const out = 'verification/paypal';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/google-chrome' });
const checks = [], errors = [];
const pass = (s) => { checks.push(s); console.log('PASS ' + s); };
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ['clipboard-read', 'clipboard-write'] });
const page = await context.newPage();
page.setDefaultTimeout(10000);
page.on('pageerror', e => errors.push(e.message));
let scenario = 'anonymous', entitled = false, captureCount = 0, planCount = 0;
await page.route('**/api/paypal/**', async route => {
  const path = new URL(route.request().url()).pathname;
  const send = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
  if (scenario === 'anonymous') return send({ error: 'SIGN_IN_REQUIRED' }, 401);
  if (path.endsWith('/status')) return send({ configured: scenario !== 'unconfigured', mode: 'sandbox', checkoutReady: scenario !== 'unconfigured', entitled, ...(['ready', 'approved'].includes(scenario) ? {} : { latestOrder: { orderId: 'QAORDER', status: entitled ? 'COMPLETED' : 'CREATED' } }) });
  if (path.endsWith('/capture')) {
    captureCount++;
    assert.deepEqual(route.request().postDataJSON(), { orderId: 'QAORDER' });
    if (scenario === 'mismatch') return send({ error: 'PAYMENT_MISMATCH' }, 409);
    if (scenario === 'failed') return send({ status: 'FAILED', entitled: false });
    if (scenario === 'revoked') return send({ status: 'REVOKED', entitled: false });
    if (scenario === 'pending' || scenario === 'cancel') return send({ status: 'PENDING', entitled: false });
    entitled = true;
    return send({ status: 'COMPLETED', entitled: true });
  }
  if (path.endsWith('/plan')) { planCount++; assert.equal(entitled, true); return send(plan); }
  if (path.endsWith('/orders')) return send(scenario === 'approved' ? { approved: true, orderId: 'QAORDER' } : { approvalUrl: 'https://www.sandbox.paypal.com/checkoutnow?token=QAORDER', orderId: 'QAORDER' });
  throw new Error('Unexpected path ' + path);
});
try {
  await page.goto(base + '/plans/kreuzberg-sunday?paid=true');
  await page.getByRole('link', { name: 'Sign in to buy · €3.99' }).waitFor();
  assert.equal(await page.locator('#your-plan').count(), 0);
  assert.equal(await page.getByText('Finish with art at Berlinische Galerie', { exact: true }).count(), 0);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.screenshot({ path: out + '/preview-mobile.png', fullPage: true });
  pass('Anonymous preview is mobile-readable; paid=true does not expose itinerary');

  await page.goto(base + '/plans/kreuzberg-sunday?checkout=return&token=QAORDER');
  const signIn = page.getByRole('link', { name: 'Sign in to buy · €3.99' });
  await signIn.waitFor();
  const href = await signIn.getAttribute('href');
  assert.equal(new URL(href, base).searchParams.get('next'), '/plans/kreuzberg-sunday?checkout=return&token=QAORDER');
  await signIn.click();
  await page.getByRole('link', { name: 'Sign up', exact: true }).waitFor();
  assert.equal(new URL(await page.getByRole('link', { name: 'Sign up', exact: true }).getAttribute('href'), base).searchParams.get('next'), '/plans/kreuzberg-sunday?checkout=return&token=QAORDER');
  pass('Sign-in/sign-up preserve the purchase return for recovery');

  scenario = 'unconfigured';
  await page.goto(base + '/plans/kreuzberg-sunday');
  await page.getByText('Checkout is not available yet.', { exact: false }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Pay €3.99 with PayPal' }).isDisabled(), true);
  pass('Missing configuration disables checkout');

  scenario = 'cancel'; captureCount = 0;
  await page.goto(base + '/plans/kreuzberg-sunday?checkout=cancel');
  await page.getByRole('button', { name: 'Check payment / recover access' }).waitFor();
  assert.equal(captureCount, 0);
  assert.equal(await page.locator('#your-plan').count(), 0);
  pass('Cancellation does not capture or unlock');

  scenario = 'pending'; planCount = 0;
  await page.goto(base + '/plans/kreuzberg-sunday?checkout=return&token=QAORDER');
  await page.getByText('Payment is not confirmed yet.', { exact: false }).waitFor();
  assert.equal(planCount, 0);
  assert.equal(await page.locator('#your-plan').count(), 0);
  await page.screenshot({ path: out + '/pending-mobile.png', fullPage: true });
  pass('Pending capture stays locked and provides a recovery action');

  scenario = 'failed';
  await page.getByRole('button', { name: 'Check payment / recover access' }).click();
  await page.getByText('Payment was declined or checkout expired.', { exact: false }).waitFor();
  assert.equal(await page.locator('#your-plan').count(), 0);
  pass('Verified failed payment stays locked and explains new checkout');

  scenario = 'mismatch';
  await page.getByRole('button', { name: 'Check payment / recover access' }).click();
  await page.getByRole('alert').filter({ hasText: 'We couldn’t verify this payment' }).waitFor();
  assert.equal(await page.locator('#your-plan').count(), 0);
  pass('Verification mismatch stays locked with a useful message');

  scenario = 'completed';
  await page.getByRole('button', { name: 'Check payment / recover access' }).click();
  await page.getByRole('heading', { name: 'Finish with art at Berlinische Galerie' }).waitFor();
  assert.equal(page.url(), base + '/plans/kreuzberg-sunday');
  await page.getByRole('button', { name: 'Copy plan for your group' }).click();
  await page.getByRole('button', { name: 'Plan copied ✓' }).waitFor();
  assert.match(await page.evaluate(() => navigator.clipboard.readText()), /Berlinische Galerie/);
  pass('Confirmed capture loads server itinerary, cleans return URL and enables group copy');
  const capturedBeforeReload = captureCount;
  await page.reload();
  await page.getByRole('heading', { name: 'Finish with art at Berlinische Galerie' }).waitFor();
  assert.equal(captureCount, capturedBeforeReload);
  pass('Returning entitlement recovers access without another capture');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: out + '/unlocked-desktop.png', fullPage: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);

  scenario = 'revoked'; entitled = false;
  await page.reload();
  await page.getByText('This payment was refunded or reversed.', { exact: false }).waitFor();
  assert.equal(await page.locator('#your-plan').count(), 0);
  pass('Revoked entitlement removes the itinerary on returning to the page');

  scenario = 'ready'; entitled = false;
  await page.route('https://www.sandbox.paypal.com/**', route => route.fulfill({ contentType: 'text/html', body: '<h1>QA intercepted PayPal destination</h1>' }));
  await page.goto(base + '/plans/kreuzberg-sunday');
  await page.getByRole('button', { name: 'Pay €3.99 with PayPal' }).click();
  await page.getByRole('heading', { name: 'QA intercepted PayPal destination' }).waitFor();
  assert.equal(page.url(), 'https://www.sandbox.paypal.com/checkoutnow?token=QAORDER');
  pass('Purchase button opens the provider-supplied sandbox approval URL (intercepted, no network payment)');

  scenario = 'approved'; entitled = false;
  await page.goto(base + '/plans/kreuzberg-sunday');
  await page.getByRole('button', { name: 'Pay €3.99 with PayPal' }).click();
  await page.getByRole('heading', { name: 'Finish with art at Berlinische Galerie' }).waitFor();
  pass('Already approved checkout is verified directly without an invalid redirect');

  // Real local API checks, outside browser interception. No credentials or real funds.
  const denied = await fetch(base + '/api/paypal/plan');
  assert.equal(denied.status, 401);
  assert.doesNotMatch(await denied.text(), /Berlinische Galerie/);
  const csrf = await fetch(base + '/api/paypal/capture', { method: 'POST', headers: { origin: 'https://untrusted.invalid', 'content-type': 'application/json' }, body: JSON.stringify({ orderId: 'QAORDER' }) });
  assert.equal(csrf.status, 403);
  pass('Actual local API rejects anonymous content access and cross-origin capture');
  assert.deepEqual(errors, []);
  writeFileSync(out + '/browser-results.json', JSON.stringify({ checks, errors, scope: 'Real local Next production UI with explicitly intercepted payment responses. Actual local anonymous/API origin checks. No genuine PayPal or production database interaction.' }, null, 2));
} finally { await browser.close(); }
