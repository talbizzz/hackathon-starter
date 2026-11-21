import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
const base=process.env.NEXT_PUBLIC_SUPABASE_URL;
assert.equal(new URL(base).hostname,'127.0.0.1');assert.equal(new URL(base).port,'55434');
const headers={apikey:process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,Authorization:`Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,'Content-Type':'application/json'};
async function req(path,body){const r=await fetch(base+'/rest/v1/'+path,{method:body===undefined?'GET':'POST',headers,body:body===undefined?undefined:JSON.stringify(body)});let data;const text=await r.text();try{data=JSON.parse(text)}catch{data=text}return {status:r.status,data};}
const checks=[];function pass(s){checks.push(s);console.log('PASS '+s)};
const spots=await req('spots?select=id,neighbourhood,name');assert.equal(spots.status,200);assert(spots.data.length>=2);pass('published inventory is readable in both supported neighbourhoods');
const creator=crypto.randomUUID(),guest=crypto.randomUUID(),planId=crypto.randomUUID(),ids=spots.data.slice(0,2).map(s=>s.id);
assert.equal((await req('plans',{id:planId,spot_ids:ids,device_id:creator,neighbourhood:'kreuzberg',source:'smoke-test'})).status,201);pass('creator can save a plan');
const opened=await req('rpc/get_plan',{p_plan_id:planId,p_device_id:guest});assert.equal(opened.status,200);assert.equal(opened.data.total_votes,0);assert.deepEqual(opened.data.spots.map(s=>s.id),ids);pass('independent recipient opens persisted shortlist');
const voted=await req('rpc/cast_vote',{p_plan_id:planId,p_spot_id:ids[1],p_device_id:guest,p_name:'QA friend'});assert.equal(voted.status,200);assert.equal(voted.data.total_votes,1);assert.equal(voted.data.my_vote,ids[1]);pass('recipient casts one vote');
const seen=await req('rpc/get_plan',{p_plan_id:planId,p_device_id:creator});assert.equal(seen.data.total_votes,1);assert.equal(seen.data.my_vote,null);assert.equal(seen.data.spots[1].votes,1);pass('creator observes recipient vote with separate identity');
const replaced=await req('rpc/cast_vote',{p_plan_id:planId,p_spot_id:ids[0],p_device_id:guest,p_name:'QA friend'});assert.equal(replaced.data.total_votes,1);assert.equal(replaced.data.my_vote,ids[0]);pass('changing one device vote does not duplicate voter');
assert.equal((await req('rpc/cast_vote',{p_plan_id:planId,p_spot_id:crypto.randomUUID(),p_device_id:guest,p_name:'QA friend'})).status,400);pass('out-of-plan vote rejected');
assert.equal((await req('rpc/get_plan',{p_plan_id:crypto.randomUUID()})).data,null);pass('missing plan remains distinct from service error');
assert.equal((await req('plans?select=id')).status,401);pass('anonymous callers cannot enumerate plans');
await fetch(base+'/qa/failure?plans=1');assert.equal((await req('rpc/get_plan',{p_plan_id:planId})).status,503);await fetch(base+'/qa/failure');pass('controlled service outage and recovery available for UI verification');
writeFileSync('/tmp/kiez-release-qa-20261121/api-results.json',JSON.stringify({checks,planId,fixtureCount:spots.data.length,scope:'Disposable Postgres17 with all repository migrations, PostgREST13.0.7, local REST proxy. No production or real phone share test.'},null,2));
