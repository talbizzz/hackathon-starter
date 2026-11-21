import {chromium} from '/home/metaphysicist/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';import {writeFileSync} from 'node:fs';
const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/google-chrome'});
const context=await browser.newContext({viewport:{width:390,height:844}});const page=await context.newPage();page.setDefaultTimeout(15000);
await page.clock.setFixedTime(new Date('2026-11-21T13:00:00Z'));
await page.addInitScript(()=>{window.__shareCalls=[];Object.defineProperty(navigator,'share',{configurable:true,value:async data=>{window.__shareCalls.push({data,active:navigator.userActivation.isActive});}});});
const checks=[];function pass(s){checks.push(s);console.log('PASS '+s)};
try{
 await page.goto('http://127.0.0.1:3085/?utm_source=smoke-test');await page.getByTestId('add-to-plan').first().click();
 await page.route('**/rest/v1/plans',r=>r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({code:'QA_OUTAGE',message:'QA save unavailable'})}));
 await page.getByTestId('share-plan').click();await page.getByText('Could not save the plan. Tap again.',{exact:true}).waitFor();assert.equal(await page.getByTestId('plan-bar').getByRole('link').count(),0);assert.equal(await page.evaluate(()=>window.__shareCalls.length),0);pass('failed save shows recovery and does not share nonexistent plan');
 await page.unroute('**/rest/v1/plans');await page.getByTestId('share-plan').click();await page.getByText('Plan saved. Tap Send to friends to share it.',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>window.__shareCalls.length),0);const path=await page.getByTestId('plan-bar').getByRole('link').getAttribute('href');pass('retry saves successfully without opening share before second tap');
 await page.getByTestId('share-plan').click();await page.waitForFunction(()=>window.__shareCalls.length===1);const calls=await page.evaluate(()=>window.__shareCalls);assert.equal(calls[0].active,true);assert.equal(calls[0].data.url,'http://127.0.0.1:3085'+path+'?utm_source=share');pass('native share adapter receives saved URL during active user gesture');
 writeFileSync('/tmp/kiez-release-qa-20261121/share-results.json',JSON.stringify({checks,scope:'Real browser click/activation and local persistence, navigator.share instrumented. Actual OS phone share sheet not tested.'},null,2));
}finally{await browser.close();}
