import {test} from 'node:test';import assert from 'node:assert/strict';
import {clearLine,route,practiceInput,difficulties} from '../service/practice.mjs';
const state={players:[{position:[0,0,260],alive:true},{position:[0,0,-260],alive:true,ammo:30}]};
test('three difficulty policies produce bounded native inputs and wait for player readiness',()=>{
 for(const difficulty of Object.keys(difficulties)){
  assert.equal(practiceInput({tick:1000,state,difficulty}).fire,false);
  const memory={};for(let tick=0;tick<1200;tick++){
   const v=practiceInput({tick,state,difficulty,ready:true,memory});
   for(const k of ['move_x','move_y'])assert.ok(Number.isFinite(v[k])&&Math.abs(v[k])<=1);
   assert.ok(Math.abs(v.yaw)<=Math.PI);assert.equal(v.jump,false);assert.equal(v.sequence,tick);
  }
 }
});
test('bots route around solid monoliths instead of shooting or walking through them',()=>{
 const a=[-50,0,-180],b=[-50,0,180];assert.equal(clearLine(a,b),false);
 const points=route(a,b);assert.ok(points.length>1);let previous=a;for(const p of points){assert.equal(clearLine(previous,p,17),true);previous=p;}
 const blocked={players:[{position:b,alive:true},{position:a,alive:true,ammo:30}]};
 for(let tick=0;tick<400;tick++)assert.equal(practiceInput({tick,state:blocked,ready:true,difficulty:'veteran'}).fire,false);
});
test('veteran has tighter aim and longer bursts; empty clips reload',()=>{
 assert.ok(difficulties.veteran.error<difficulties.standard.error);assert.ok(difficulties.standard.error<difficulties.rookie.error);assert.ok(difficulties.veteran.burst>difficulties.standard.burst);
 const empty=structuredClone(state);empty.players[1].ammo=0;assert.equal(practiceInput({tick:500,state:empty,ready:true}).reload,true);
 empty.players[1].alive=false;assert.equal(practiceInput({tick:500,state:empty,ready:true}).fire,false);
});
