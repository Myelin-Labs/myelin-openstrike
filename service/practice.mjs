import arena from './arena.json' with {type:'json'};
export const difficulties=Object.freeze({rookie:{error:.18,burst:8,period:210,delay:640,range:340,strafe:.22},standard:{error:.055,burst:24,period:128,delay:256,range:290,strafe:.45},veteran:{error:.018,burst:40,period:100,delay:192,range:250,strafe:.7}});
export function clearLine(a,b,padding=0){
 for(const o of arena.obstacles){let low=0,high=1;
  for(const axis of [0,2]){const d=b[axis]-a[axis],min=o.min[axis]-padding,max=o.max[axis]+padding;
   if(Math.abs(d)<1e-8){if(a[axis]<min||a[axis]>max){low=2;break;}}
   else{let t1=(min-a[axis])/d,t2=(max-a[axis])/d;if(t1>t2)[t1,t2]=[t2,t1];low=Math.max(low,t1);high=Math.min(high,t2);}
  }if(low<=high&&high>=0&&low<=1)return false;
 }return true;
}
const nodes=[];for(let z=-432;z<=432;z+=48)for(let x=-432;x<=432;x+=48){const p=[x,0,z];if(clearLine(p,p,18))nodes.push(p);}
const neighbors=nodes.map(a=>nodes.flatMap((b,i)=>Math.abs(a[0]-b[0])+Math.abs(a[2]-b[2])===48&&clearLine(a,b,18)?[i]:[]));
function nearest(p){let best=0,d=Infinity;nodes.forEach((n,i)=>{const v=Math.hypot(n[0]-p[0],n[2]-p[2]);if(v<d&&clearLine(p,n,17)){best=i;d=v;}});return best;}
export function route(from,to){
 const start=nearest(from),goal=nearest(to),previous=new Map([[start,-1]]),queue=[start];
 for(let n=0;n<queue.length;n++){const index=queue[n];if(index===goal)break;for(const next of neighbors[index])if(!previous.has(next)){previous.set(next,index);queue.push(next);}}
 if(!previous.has(goal))return [];const path=[];for(let n=goal;n!==start;n=previous.get(n))path.push(nodes[n]);return path.reverse();
}
export function practiceInput({tick,state,difficulty='standard',ready=false,memory={}}){
 const config=difficulties[difficulty]||difficulties.standard,me=state?.players?.[1],other=state?.players?.[0];
 const input={sequence:tick,client_tick:tick,move_x:0,move_y:0,yaw:Math.PI,pitch:0,walk:false,jump:false,fire:false,reload:false};
 if(!me||!other||!ready||!me.alive||!other.alive)return input;
 const from=me.position,to=other.position,dx=to[0]-from[0],dz=to[2]-from[2],distance=Math.hypot(dx,dz),visible=clearLine(from,to);
 const aim=Math.atan2(-dx,-dz)+Math.sin(tick/43)*config.error;input.yaw=Math.atan2(Math.sin(aim),Math.cos(aim));
 let vx=0,vz=0;
 if(!visible){
  if(!memory.path||tick-(memory.planned||0)>=32){memory.path=route(from,to);memory.planned=tick;}
  while(memory.path.length&&Math.hypot(memory.path[0][0]-from[0],memory.path[0][2]-from[2])<26)memory.path.shift();
  const waypoint=memory.path[0];if(waypoint){vx=waypoint[0]-from[0];vz=waypoint[2]-from[2];}
 }else{
  memory.path=null;const advance=distance>config.range?.7:distance<130?-.45:0,strafe=(Math.floor(tick/180)%2?1:-1)*config.strafe;
  vx=dx/Math.max(1,distance)*advance-dz/Math.max(1,distance)*strafe;vz=dz/Math.max(1,distance)*advance+dx/Math.max(1,distance)*strafe;
 }
 const length=Math.hypot(vx,vz);if(length){vx/=length;vz/=length;const ahead=[from[0]+vx*24,0,from[2]+vz*24];if(Math.abs(ahead[0])<450&&Math.abs(ahead[2])<450&&clearLine(from,ahead,17)){input.move_x=Math.max(-1,Math.min(1,Math.cos(input.yaw)*vx-Math.sin(input.yaw)*vz));input.move_y=Math.max(-1,Math.min(1,-Math.sin(input.yaw)*vx-Math.cos(input.yaw)*vz));}}
 input.fire=visible&&tick>config.delay&&tick%config.period<config.burst;input.reload=me.ammo===0;return input;
}
