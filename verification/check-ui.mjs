import {chromium} from '/home/metaphysicist/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';import {writeFileSync} from 'node:fs';
const base='http://127.0.0.1:3085',api='http://127.0.0.1:55434';const out='/tmp/kiez-release-qa-20261121';const checks=[];
const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/google-chrome'});
const creator=await browser.newContext({viewport:{width:390,height:844},permissions:['clipboard-read','clipboard-write']});const guest=await browser.newContext({viewport:{width:1440,height:1000}});
const a=await creator.newPage(),b=await guest.newPage();await a.clock.setFixedTime(new Date('2026-11-21T13:00:00Z'));await b.clock.setFixedTime(new Date('2026-11-21T13:00:00Z'));
a.setDefaultTimeout(15000);b.setDefaultTimeout(15000);
const errors=[];a.on('pageerror',e=>errors.push(e.message));b.on('pageerror',e=>errors.push(e.message));
function pass(s){checks.push(s);console.log('PASS '+s)}
try{
 await a.goto(base+'/?utm_source=smoke-test');await a.getByRole('heading',{name:'Stadtbad Neukölln',exact:true}).first().waitFor();pass('production display-label Neukölln appears in canonical filter');
 await a.screenshot({path:out+'/home-mobile.png',fullPage:true});
 await a.getByTestId('add-to-plan').first().click();assert.match(await a.getByTestId('plan-bar').innerText(),/1\/3/);
 await a.getByRole('button',{name:'Kreuzberg',exact:true}).click();await a.getByTestId('plan-bar').waitFor({state:'detached'});pass('changing neighbourhood clears hidden shortlist');
 const card=(page,name)=>page.getByTestId('spot-card').filter({has:page.getByRole('heading',{name,exact:true})}).first();
 await card(a,'Kunstraum Kreuzberg/Bethanien').getByTestId('add-to-plan').click();await card(a,'Jüdisches Museum Berlin — core exhibition').getByTestId('add-to-plan').click();
 await a.getByTestId('share-plan').click();await a.getByText('Plan saved. Tap Send to friends to share it.',{exact:true}).waitFor();const path=await a.getByTestId('plan-bar').getByRole('link').getAttribute('href');assert.match(path,/^\/p\/[0-9a-f-]{36}$/);pass('save creates persisted plan before share');
 await a.getByTestId('share-plan').click();await a.getByText('Link copied',{exact:true}).waitFor();const copied=await a.evaluate(()=>navigator.clipboard.readText());assert.equal(copied,base+path+'?utm_source=share');pass('fresh share tap copies correct saved URL');
 await a.goto(base+path);await b.goto(copied);await b.getByTestId('vote-name').fill('QA friend');await b.getByTestId('vote-button').first().click();await b.getByText('QA friend',{exact:false}).first().waitFor();await a.getByText('QA friend',{exact:false}).first().waitFor();pass('separate browser recipient vote reaches creator by polling');
 await b.getByTestId('vote-button').nth(1).click();await b.getByTestId('vote-button').nth(1).filter({hasText:'Your vote'}).waitFor();await card(a,'Jüdisches Museum Berlin — core exhibition').getByText('1 vote',{exact:false}).waitFor();pass('recipient changes vote without creating another voter and creator sees replacement');
 await b.screenshot({path:out+'/plan-desktop.png',fullPage:true});await a.screenshot({path:out+'/plan-mobile.png',fullPage:true});
 await fetch(api+'/qa/failure?plans=1');await b.reload();await b.getByText('We couldn’t load this plan. Please try again.',{exact:true}).waitFor();await fetch(api+'/qa/failure');await b.getByRole('button',{name:'Try again',exact:true}).click();await b.getByTestId('vote-button').first().waitFor();pass('plan service failure shows retry and recovers');
 await fetch(api+'/qa/failure?spots=1');await a.goto(base);await a.getByText('We couldn’t load the spots. Please try again.',{exact:true}).waitFor();await fetch(api+'/qa/failure');await a.getByRole('button',{name:'Try again',exact:true}).click();await a.getByTestId('spot-card').first().waitFor();pass('home service failure shows retry and recovers');
 await a.getByRole('button',{name:'Nightlife',exact:true}).click();await a.getByRole('button',{name:'Clear filters',exact:true}).click();await a.getByTestId('spot-card').first().waitFor();pass('empty category filters have working clear action');
 await a.goto(base+'/p/not-a-uuid');await a.getByText('This plan does not exist.',{exact:true}).first().waitFor();pass('invalid plan remains a missing-plan state');
 assert.equal(errors.length,0,errors.join('\n'));
 writeFileSync(out+'/ui-results.json',JSON.stringify({checks,errors,planPath:path,scope:'Real local Next UI; two isolated Chromium contexts; disposable Postgres/PostgREST. Clipboard fallback tested; actual phone OS share sheet and production deployment not tested.'},null,2));
}catch(e){console.error('UI TEXT',await a.locator('body').innerText(),await b.locator('body').innerText());await a.screenshot({path:out+'/failure-mobile.png',fullPage:true});throw e;}finally{await fetch(api+'/qa/failure');await browser.close();}
