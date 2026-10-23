import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {createInterface} from 'node:readline';
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..'),assets=path.join(root,'release'),bin=path.join(assets,'myelin-arena-bridge'),dir=mkdtempSync(path.join(tmpdir(),'openstrike-test-'));
const env={...process.env,OPENSTRIKE_ASSETS:assets};
const base=slot=>({sequence:0,client_tick:0,move_x:0,move_y:0,yaw:slot?Math.PI:0,pitch:0,walk:false,jump:false,fire:!slot,reload:false});
try{
 const child=spawn(bin,[],{stdio:['pipe','pipe','inherit']});let tape='',live;const lines=createInterface({input:child.stdout});
 const step=tick=>{const input={inputs:[base(0),base(1)].map(v=>({...v,fire:v.fire&&tick>128,sequence:tick,client_tick:tick}))};const line=JSON.stringify(input)+'\n';tape+=line;child.stdin.write(line);};
 lines.on('line',line=>{const v=JSON.parse(line);if(v.type==='frame'){if(v.frame.state.phase!=='Live')child.stdin.end();else step(v.frame.tick+1);}else live=v.result;});step(1);
 await new Promise((resolve,reject)=>{child.on('exit',c=>c===0?resolve():reject(Error('native exit '+c)));child.on('error',reject);});
 assert.equal(live.completed,true);assert.equal(live.last.state.phase.Ended.winner,'A');
 const file=path.join(dir,'tape.jsonl');writeFileSync(file,tape);
 let r=spawnSync(bin,['replay',file],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);assert.deepEqual(JSON.parse(r.stdout),live);
 const match={type:'match',room:'a'.repeat(24),players:['a'.repeat(64),'b'.repeat(64)],tape,result:live};writeFileSync(path.join(dir,'match.json'),JSON.stringify(match));
 r=spawnSync(path.join(assets,'myelin-openstrike'),['record',path.join(dir,'session'),path.join(dir,'match.json')],{encoding:'utf8',env,maxBuffer:12e6});assert.equal(r.status,0,r.stderr);const recorded=JSON.parse(r.stdout);assert.equal(recorded.replay.verified,true);writeFileSync(path.join(dir,'export.json'),JSON.stringify(recorded.export));
 r=spawnSync(path.join(assets,'myelin-openstrike'),['verify',path.join(dir,'export.json')],{encoding:'utf8',env});assert.equal(r.status,0,r.stderr);assert.equal(JSON.parse(r.stdout).verified,true);
 // A result that did not occur cannot be admitted as a new match.
 match.result.trace_hash='0'.repeat(64);writeFileSync(path.join(dir,'forged.json'),JSON.stringify(match));r=spawnSync(path.join(assets,'myelin-openstrike'),['record',path.join(dir,'forged'),path.join(dir,'forged.json')],{encoding:'utf8',env});assert.notEqual(r.status,0);
 const corrupt=recorded.export;corrupt.blocks[0]='00'+corrupt.blocks[0].slice(2);writeFileSync(path.join(dir,'corrupt.json'),JSON.stringify(corrupt));r=spawnSync(path.join(assets,'myelin-openstrike'),['verify',path.join(dir,'corrupt.json')],{encoding:'utf8',env});assert.notEqual(r.status,0);
 // Full-length timeout: large tapes and exports must remain replayable.
 const timeoutLine=JSON.stringify({inputs:[base(0),base(1)].map(v=>({...v,fire:false}))})+'\n';
 const timeoutTape=timeoutLine.repeat(5760);writeFileSync(file,timeoutTape);
 r=spawnSync(bin,['replay',file],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);const timed=JSON.parse(r.stdout);assert.equal(timed.completed,true);assert.equal(timed.ticks,5760);assert.equal(timed.last.state.phase,'Live');
 writeFileSync(path.join(dir,'timeout.json'),JSON.stringify({...match,tape:timeoutTape,result:timed}));
 r=spawnSync(path.join(assets,'myelin-openstrike'),['record',path.join(dir,'timeout-session'),path.join(dir,'timeout.json')],{encoding:'utf8',env,maxBuffer:16e6});assert.equal(r.status,0,r.stderr);const timedExport=JSON.parse(r.stdout).export;writeFileSync(path.join(dir,'timeout-export.json'),JSON.stringify(timedExport));
 r=spawnSync(path.join(assets,'myelin-openstrike'),['verify',path.join(dir,'timeout-export.json')],{encoding:'utf8',env,maxBuffer:16e6});assert.equal(r.status,0,r.stderr);
 writeFileSync(file,timeoutTape+timeoutLine);assert.notEqual(spawnSync(bin,['replay',file],{encoding:'utf8'}).status,0);
 console.log('PASS: native live/replay equality, kill result, real Myelin record/export/verify, forged result/tampered export rejected, full 90-second timeout export, overlong tape rejected. Kill ticks:',live.ticks);
}finally{rmSync(dir,{recursive:true,force:true});}
