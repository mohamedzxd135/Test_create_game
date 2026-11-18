import React,{useEffect,useRef,useState}from'react';
import{createRoot}from'react-dom/client';
import*as THREE from'three';
import './style.css';

const classes={
 swordsman:{name:'SWORDSMAN',tag:'Knight',color:'#efb35a',hp:160,skills:['Solar Slash','Shield Break','Lionheart']},
 archer:{name:'ARCHER',tag:'Ranger',color:'#77d69a',hp:120,skills:['Rapid Volley','Piercing Shot','Wind Step']},
 mage:{name:'MAGE',tag:'Sorcerer',color:'#8aa7ff',hp:105,skills:['Arcane Bolt','Frost Nova','Time Warp']}
};

function makeWorld(canvas,cls,onStats){
 const scene=new THREE.Scene();scene.background=new THREE.Color('#98c9e5');scene.fog=new THREE.Fog('#98c9e5',90,220);
 const camera=new THREE.PerspectiveCamera(48,canvas.clientWidth/canvas.clientHeight,.1,500);camera.position.set(18,18,26);
 const renderer=new THREE.WebGLRenderer({canvas,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(canvas.clientWidth,canvas.clientHeight,false);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 scene.add(new THREE.HemisphereLight('#dff4ff','#4b6b45',2.2));const sun=new THREE.DirectionalLight('#fff1c6',3);sun.position.set(-40,60,20);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-80;sun.shadow.camera.right=80;sun.shadow.camera.top=80;sun.shadow.camera.bottom=-80;scene.add(sun);
 const mat=(c,rough=.8)=>new THREE.MeshStandardMaterial({color:c,roughness:rough});
 // terrain
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(190,190),mat('#70a85e'));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
 const river=new THREE.Mesh(new THREE.PlaneGeometry(18,190),mat('#53b9cf',.25));river.rotation.x=-Math.PI/2;river.rotation.z=.18;river.position.set(58,0.03,-5);river.receiveShadow=true;scene.add(river);
 // roads
 const roadMat=mat('#c9ad78');const road=new THREE.Mesh(new THREE.PlaneGeometry(14,150),roadMat);road.rotation.x=-Math.PI/2;road.position.set(-3,.02,-4);scene.add(road);const road2=new THREE.Mesh(new THREE.PlaneGeometry(125,10),roadMat);road2.rotation.x=-Math.PI/2;road2.position.set(-5,.025,-15);scene.add(road2);
 function box(x,y,z,w,h,d,m,rx=0,rz=0){const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y+h/2,z);o.rotation.x=rx;o.rotation.z=rz;o.castShadow=o.receiveShadow=true;scene.add(o);return o}
 function cone(x,y,z,r,h,m){const o=new THREE.Mesh(new THREE.ConeGeometry(r,h,8),m);o.position.set(x,y+h/2,z);o.castShadow=true;scene.add(o);return o}
 // mountain backdrop
 for(let i=0;i<14;i++){let x=-85+i*13;cone(x,-1,-72+(i%3)*8,16+(i%4)*3,38+(i%5)*5,mat(i%2?'#8196a1':'#91a8aa'));}
 // village houses
 for(let i=0;i<12;i++){let x=-50+(i%6)*18,y=-38+Math.floor(i/6)*48;if(Math.abs(x)<12&&y>-20)y=-38;const c=i%3==0?'#b97454':i%3==1?'#d5c49a':'#9b7458';box(x,.0,y,10,7,8,mat(c));cone(x,7,y,7.8,5,mat('#6f3f35'));}
 // Capital buildings
 box(-5,0,-10,24,12,20,mat('#d6c6a3'));box(-5,12,-10,18,5,16,mat('#eee1b5'));cone(-5,17,-10,13,8,mat('#76504a'));for(let x of[-12,2])box(x,0,-0.5,5,9,5,mat('#cbbd98'));
 // palace
 box(-5,0,20,38,16,24,mat('#e8dfbd'));box(-5,16,20,31,6,18,mat('#c5b58e'));for(let x of[-20,-5,10]){box(x,22,20,7,13,7,mat('#c4c0a5'));cone(x,35,20,6,8,mat('#6079a0'));}
 // arena
 const arena=new THREE.Mesh(new THREE.CylinderGeometry(18,20,5,16),mat('#b68a5c'));arena.position.set(-42,.05,-5);arena.receiveShadow=true;scene.add(arena);const arenaInner=new THREE.Mesh(new THREE.CylinderGeometry(12,12,.12,16),mat('#c8b680'));arenaInner.position.set(-42,2.55,-5);scene.add(arenaInner);
 // market stalls
 for(let i=0;i<5;i++){let x=24+i*9;box(x,0,-10,7,5,6,mat(i%2?'#dba95d':'#a95d49'));box(x,5,-10,8,.5,7,mat(i%2?'#7ca0a4':'#d1b36a'));}
 // trees
 for(let i=0;i<60;i++){let x=-88+((i*37)%176),z=-78+((i*61)%150);if(x>-26&&x<28&&z>-24&&z<32)continue;if(x>48)continue;const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.5,.8,4,7),mat('#6a4a32'));trunk.position.set(x,2,z);trunk.castShadow=true;scene.add(trunk);cone(x,4,z,3+(i%3),7+(i%4),mat(i%2?'#386d3c':'#4f8145'));}
 // forest path signs
 box(44,0,-55,1,5,1,mat('#75452d'));box(40,4,-55,9,1.8,1,mat('#9e7048'));
 // player
 const player=new THREE.Group();scene.add(player);const body=new THREE.Mesh(new THREE.CapsuleGeometry(1,2.4,4,8),mat(cls==='mage'?'#546fc1':cls==='archer'?'#4e9a69':'#b6a28d'));body.position.y=3;body.castShadow=true;player.add(body);const head=new THREE.Mesh(new THREE.SphereGeometry(.9,12,8),mat('#f1c39b'));head.position.y=6.1;head.castShadow=true;player.add(head);if(cls==='mage'){cone(0,7,0,1.2,3,mat('#4d51a8'));}if(cls==='swordsman'){box(1.4,2.5,.2,.35,5,.35,mat('#cbd5dd'));}if(cls==='archer'){const bow=new THREE.Mesh(new THREE.TorusGeometry(1.5,.12,6,16,Math.PI),mat('#9a5b32'));bow.position.set(1.4,4,0);bow.rotation.y=Math.PI/2;player.add(bow)}
 player.position.set(-3,0,-28);
 // enemies
 const enemies=[];for(let i=0;i<5;i++){const g=new THREE.Group();const b=new THREE.Mesh(new THREE.CapsuleGeometry(.8,1.5,4,8),mat(i%2?'#6b743b':'#8c5638'));b.position.y=2.3;b.castShadow=true;g.add(b);const h=new THREE.Mesh(new THREE.SphereGeometry(.8,10,8),mat('#9aa64f'));h.position.y=4.5;g.add(h);g.position.set(10+i*7,0,-42-(i%3)*8);scene.add(g);enemies.push(g)}
 let hp=classes[cls].hp,energy=72,keys={},camAngle=.7,target=new THREE.Vector3(-3,0,-28),cool=0;
 addEventListener('keydown',e=>{keys[e.key.toLowerCase()]=true});addEventListener('keyup',e=>{keys[e.key.toLowerCase()]=false});
 const clock=new THREE.Clock();let elapsed=0;function animate(){requestAnimationFrame(animate);let dt=Math.min(clock.getDelta(),.05);elapsed+=dt;if(keys.w||keys.arrowup)player.position.z-=dt*10;if(keys.s||keys.arrowdown)player.position.z+=dt*10;if(keys.a||keys.arrowleft)player.position.x-=dt*10;if(keys.d||keys.arrowright)player.position.x+=dt*10;if(keys.q&&cool<=0){cool=1.2;energy=Math.max(0,energy-18);player.scale.set(1.25,1.25,1.25);setTimeout(()=>player.scale.set(1,1,1),180)}cool-=dt;energy=Math.min(100,energy+dt*2);player.position.x=Math.max(-80,Math.min(78,player.position.x));player.position.z=Math.max(-78,Math.min(78,player.position.z));target.lerp(player.position,.08);camera.position.set(target.x+22*Math.cos(camAngle),19,target.z+22*Math.sin(camAngle));camera.lookAt(target.x,3,target.z);body.rotation.y=Math.sin(elapsed*2)*.05;for(let i=0;i<enemies.length;i++){const e=enemies[i];e.rotation.y+=dt*.2;e.position.x+=Math.sin(elapsed*.5+i)*dt*.25}renderer.render(scene,camera);onStats({hp,energy,x:Math.round(player.position.x),z:Math.round(player.position.z)})}animate();
 function resize(){camera.aspect=canvas.clientWidth/canvas.clientHeight;camera.updateProjectionMatrix();renderer.setSize(canvas.clientWidth,canvas.clientHeight,false)}addEventListener('resize',resize);return()=>{removeEventListener('resize',resize)}
}

function App(){const canvas=useRef(),[cls,setCls]=useState('swordsman'),[screen,setScreen]=useState('select'),[stats,setStats]=useState({hp:160,energy:72,x:0,z:-28});
 useEffect(()=>{if(screen==='game')return makeWorld(canvas.current,cls,setStats)},[screen,cls]);
 const c=classes[cls];
 return <><div className="grain"/><main className={screen==='select'?'select-screen':'game-screen'}>
 {screen==='select'?<section className="hero"><div className="brand"><span>ROYAL REALM OF</span><h1>ELYNDOR</h1></div><p className="kicker">CHOOSE YOUR CHAMPION</p><div className="classes">{Object.entries(classes).map(([key,v])=><button key={key} className={'class-card '+key+(cls===key?' active':'')} onClick={()=>setCls(key)}><div className="silhouette"><i/><b/><em/></div><div className="card-shade"/><h2>{v.name}</h2><p>{v.tag}</p></button>)}</div><button className="begin" onClick={()=>setScreen('game')}>BEGIN ADVENTURE <span>›</span></button></section>:<>
 <canvas ref={canvas}/><header><div className="brand small"><span>ROYAL REALM OF</span><h1>ELYNDOR</h1></div><div className="location">◇ <b>ROYAL CAPITAL</b><span>VALLEY DISTRICT</span></div><button className="menu" onClick={()=>setScreen('select')}>☰</button></header>
 <aside className="left-panel"><div className="portrait"><div className="mini-face"/></div><div className="player-info"><b>{c.name}</b><span>Lv. 12 · Knight</span></div><div className="bars"><div><i style={{width:stats.hp/c.hp*100+'%'}}/></div><div className="energy"><i style={{width:stats.energy+'%'}}/></div></div></aside>
 <aside className="quest"><small>MAIN QUEST</small><h3>THE AWAKENING</h3><p>Speak with the Royal Guard</p></aside>
 <div className="compass"><span>NW</span><b>◆</b><span>N</span><span>NE</span></div>
 <div className="actionbar">{c.skills.map((s,i)=><button key={s} onClick={()=>{}}><kbd>{i+1}</kbd><div className={'skill s'+i}/><span>{s}</span></button>)}</div>
 <div className="controls">WASD <span>MOVE</span> &nbsp; Q <span>ABILITY</span></div>
 </>}
 </main></> }
createRoot(document.getElementById('root')).render(<App/>);
