/**
 * Zero-npm-dependency Chromium smoke test for the PhiCircuitLab classroom.
 * Starts a local web server, uses Chrome DevTools Protocol, then closes it.
 * Chrome/Chromium must be available on PATH; no external services are used.
 */
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const root=process.cwd();
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json'};
const candidates=[process.env.CHROME_BIN,'google-chrome','google-chrome-stable','chromium','chromium-browser'].filter(Boolean);
let chromeBin=null;
for(const bin of candidates){
  if(spawnSync('which',[bin],{stdio:'ignore'}).status===0){chromeBin=bin;break;}
}
if(!chromeBin)throw new Error('Chromium or Google Chrome is required to run the browser smoke test');

const server=createServer(async(req,res)=>{
  try{
    const requested=new URL(req.url,'http://127.0.0.1').pathname;
    const filename=path.resolve(root,'.'+(requested==='/'?'/index.html':requested));
    if(filename!==root&&!filename.startsWith(root+path.sep)){
      res.writeHead(403);res.end('Forbidden');return;
    }
    const body=await readFile(filename);
    res.writeHead(200,{'content-type':mime[path.extname(filename)]||'application/octet-stream'});
    res.end(body);
  }catch(_){res.writeHead(404);res.end('Not found');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const url='http://127.0.0.1:'+server.address().port+'/';
const profile=await mkdtemp(path.join(os.tmpdir(),'phi-wiring-smoke-'));
// Chrome's pipe transport avoids flaky TCP debugging-port discovery on
// shared GitHub Actions runners, and keeps the browser debug endpoint private.
const chrome=spawn(chromeBin,['--headless=new','--no-sandbox','--disable-dev-shm-usage',
  '--disable-gpu','--no-first-run','--no-default-browser-check',
  '--disable-background-networking','--disable-extensions',
  '--user-data-dir='+profile,'--remote-debugging-pipe',url],
  {stdio:['ignore','ignore','ignore','pipe','pipe']});

try {
  let serial=0,buffer='';
  const pending=new Map(),exceptions=[];
  const protocolOut=chrome.stdio[3];
  const protocolIn=chrome.stdio[4];
  protocolIn.on('data',chunk=>{
    buffer+=chunk.toString('utf8');
    let index;
    while((index=buffer.indexOf('\0'))!==-1){
      const item=buffer.slice(0,index);buffer=buffer.slice(index+1);
      if(!item.trim())continue;
      let packet;
      try{packet=JSON.parse(item);}catch(_){continue;}
      if(packet.method==='Runtime.exceptionThrown'){
        exceptions.push(packet.params?.exceptionDetails?.exception?.description||JSON.stringify(packet.params?.exceptionDetails)||'Browser JavaScript exception');
      }
      if(!packet.id)continue;
      const callback=pending.get(packet.id);
      if(!callback)continue;
      pending.delete(packet.id);
      clearTimeout(callback.timer);
      if(packet.error)callback.reject(new Error(packet.error.message));
      else callback.resolve(packet.result);
    }
  });
  const cdp=(method,params={},sessionId=null)=>new Promise((resolve,reject)=>{
    const id=++serial;
    const timer=setTimeout(()=>{
      pending.delete(id);reject(new Error('CDP timed out: '+method));
    },8000);
    pending.set(id,{resolve,reject,timer});
    const command={id,method,params};
    if(sessionId)command.sessionId=sessionId;
    protocolOut.write(JSON.stringify(command)+'\0');
  });
  let target;
  // Shared runners sometimes take longer than 8 seconds to start Chrome.
  // Retry the protocol handshake instead of failing on the first request.
  let startupError=null;
  const startupDeadline=Date.now()+45000;
  while(Date.now()<startupDeadline){
    if(chrome.exitCode!==null)throw new Error('Chromium exited during startup');
    try{
      const tabs=await cdp('Target.getTargets');
      target=tabs.targetInfos?.find(t=>t.type==='page');
      if(target)break;
    }catch(err){startupError=err;}
    await new Promise(resolve=>setTimeout(resolve,350));
  }
  if(!target)throw new Error('Chromium did not create a page target: '+(startupError?.message||'startup timed out'));
  const attached=await cdp('Target.attachToTarget',{targetId:target.targetId,flatten:true});
  const sessionId=attached.sessionId;
  await cdp('Runtime.enable',{},sessionId);
  async function evaluate(expression){
    const response=await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true},sessionId);
    if(response.exceptionDetails)throw new Error('Browser exception: '+response.exceptionDetails.text);
    return response.result.value;
  }
  const initial=await evaluate("(async()=>{for(let n=0;n<60&&!document.querySelector('#app-content h1');n++)await new Promise(r=>setTimeout(r,50));return {title:document.querySelector('#app-content h1')?.textContent,hasBuilder:!!document.querySelector('[data-view=builder]')}})()");
  assert.match(initial.title||'',/Build the knowledge/);
  assert.equal(initial.hasBuilder,true);
  console.log('PASS: classroom loads and exposes the Wiring Lab');
  const opened=await evaluate("(()=>{document.querySelector('[data-view=builder]').click();return {title:document.querySelector('#app-content h1')?.textContent,status:document.querySelector('#wiring-state')?.textContent}})()");
  assert.match(opened.title||'',/Wiring Sandbox/);
  assert.equal(opened.status,'Connected circuit');
  console.log('PASS: Wiring Lab opens and solves the series preset');
  const series=await evaluate("({current:document.querySelector('#wiring-current').textContent,eq:document.querySelector('#wiring-equivalent').textContent})");
  assert.equal(series.current,'4.500 mA');
  assert.equal(series.eq,'2000.00 Ω');
  const open=await evaluate("(()=>{const s=document.querySelector('#wiring-preset');s.value='open';s.dispatchEvent(new Event('change',{bubbles:true}));return {status:document.querySelector('#wiring-state').textContent,current:document.querySelector('#wiring-current').textContent}})()");
  assert.equal(open.status,'Open circuit');
  assert.equal(open.current,'0.000 mA');
  console.log('PASS: blank circuit reports open topology');
  for(const terminal of ['V+','R1:a','R1:b','R2:a','R2:b','GND']){
    const success=await evaluate("(()=>{const t=document.querySelector('[data-terminal="+JSON.stringify(terminal)+"]');if(!t)return false;t.dispatchEvent(new MouseEvent('click',{bubbles:true}));return true;})()");
    assert.equal(success,true,'Missing SVG terminal: '+terminal);
  }
  const connected=await evaluate("({status:document.querySelector('#wiring-state').textContent,current:document.querySelector('#wiring-current').textContent,eq:document.querySelector('#wiring-equivalent').textContent})");
  assert.equal(connected.status,'Connected circuit');
  assert.equal(connected.current,'4.500 mA');
  assert.equal(connected.eq,'2000.00 Ω');
  console.log('PASS: user-drawn wires form a computed series network');
  const deleted=await evaluate("(()=>{document.querySelector('[data-wire-index=\"0\"]').dispatchEvent(new MouseEvent('click',{bubbles:true}));document.querySelector('#wiring-delete').click();return document.querySelector('#wiring-state').textContent})()");
  assert.equal(deleted,'Open circuit');
  console.log('PASS: deleting a wire breaks the live circuit');
  const undo=await evaluate("(()=>{document.querySelector('#wiring-undo').click();return document.querySelector('#wiring-state').textContent})()");
  assert.equal(undo,'Connected circuit');
  console.log('PASS: undo restores the circuit');
  const short=await evaluate("(()=>{const s=document.querySelector('#wiring-preset');s.value='open';s.dispatchEvent(new Event('change',{bubbles:true}));for(const t of ['V+','GND'])document.querySelector('[data-terminal=\"'+t+'\"]').dispatchEvent(new MouseEvent('click',{bubbles:true}));return {status:document.querySelector('#wiring-state').textContent,current:document.querySelector('#wiring-current').textContent}})()");
  assert.equal(short.status,'Ideal source short detected');
  assert.equal(short.current,'—');
  console.log('PASS: ideal short is diagnosed without inventing a current');
  // A switch should interrupt and restore a real user-built circuit.
  const switchOpen=await evaluate("(()=>{const p=document.querySelector('#wiring-preset');p.value='switch';let exception=null;try{p.dispatchEvent(new Event('change',{bubbles:true}));}catch(e){exception=e.message;}return {status:document.querySelector('#wiring-state').textContent,visible:!!document.querySelector('[data-part-id=S1]'),preset:p.value,optionCount:p.options.length,exception}})()");
  console.log('Switch preset transition:',JSON.stringify(switchOpen),'browser exceptions:',JSON.stringify(exceptions));
  assert.equal(switchOpen.status,'Open circuit');
  assert.equal(switchOpen.visible,true);
  const switchClosed=await evaluate("(()=>{document.querySelector('[data-part-id=S1]').dispatchEvent(new MouseEvent('click',{bubbles:true}));const toggle=document.querySelector('#wiring-toggle-switch');if(!toggle)return {error:'No switch toggle'};toggle.click();return {status:document.querySelector('#wiring-state').textContent,current:document.querySelector('#wiring-current').textContent,openText:document.querySelector('#wiring-toggle-switch')?.textContent}})()");
  assert.equal(switchClosed.status,'Connected circuit');
  assert.equal(switchClosed.current,'9.000 mA');
  assert.ok(!switchClosed.error);
  const toggledOff=await evaluate("(()=>{document.querySelector('#wiring-toggle-switch').click();return {status:document.querySelector('#wiring-state').textContent,current:document.querySelector('#wiring-current').textContent}})()");
  assert.equal(toggledOff.status,'Open circuit');
  assert.equal(toggledOff.current,'0.000 mA');
  console.log('PASS: switch toggling opens and closes the circuit in the browser');
  const switchUndo=await evaluate("(()=>{document.querySelector('#wiring-undo').click();return document.querySelector('#wiring-state').textContent})()");
  assert.equal(switchUndo,'Connected circuit');
  console.log('PASS: undo restores the previous switch position');
  const switchAdded=await evaluate("(()=>{document.querySelector('#wiring-add-switch').click();return !!document.querySelector('[data-part-id=S2]')})()");
  assert.equal(switchAdded,true);
  console.log('PASS: palette creates a second switch');
  const ledOn=await evaluate("(()=>{const p=document.querySelector('#wiring-preset');p.value='led';p.dispatchEvent(new Event('change',{bubbles:true}));return {status:document.querySelector('#wiring-state').textContent,current:document.querySelector('#wiring-current').textContent,led:!!document.querySelector('[data-part-id=D1]'),row:document.querySelector('#wiring-readings-body').textContent}})()");
  assert.equal(ledOn.status,'Connected circuit');
  assert.equal(ledOn.current,'8.571 mA');
  assert.equal(ledOn.led,true);
  assert.match(ledOn.row, /D1/);
  assert.match(ledOn.row, /on/);
  console.log('PASS: forward LED with limiting resistor lights from calculated current');
  const green=await evaluate("(()=>{document.querySelector('[data-part-id=D1]').dispatchEvent(new MouseEvent('click',{bubbles:true}));const select=document.querySelector('#wiring-led-color');if(!select)return {error:'LED inspector not available'};select.value='green';select.dispatchEvent(new Event('change',{bubbles:true}));return {current:document.querySelector('#wiring-current').textContent,selected:document.querySelector('#wiring-led-color')?.value}})()");
  assert.ok(!green.error);
  assert.equal(green.selected,'green');
  assert.equal(green.current,'8.000 mA');
  console.log('PASS: LED color inspector changes model current');
  const reversed=await evaluate("(()=>{const p=document.querySelector('#wiring-preset');p.value='reverse-led';p.dispatchEvent(new Event('change',{bubbles:true}));return {status:document.querySelector('#wiring-state').textContent,current:document.querySelector('#wiring-current').textContent,rows:document.querySelector('#wiring-readings-body').textContent,notes:document.querySelector('#wiring-notices').textContent}})()");
  assert.equal(reversed.status,'Open circuit');
  assert.equal(reversed.current,'0.000 mA');
  assert.match(reversed.rows,/reverse/);
  assert.match(reversed.notes,/Reverse-biased/);
  console.log('PASS: reverse LED polarity blocks current and warns');
  const unlimited=await evaluate("(()=>{const p=document.querySelector('#wiring-preset');p.value='led-unlimited';p.dispatchEvent(new Event('change',{bubbles:true}));return {current:document.querySelector('#wiring-current').textContent,notes:document.querySelector('#wiring-notices').textContent}})()");
  assert.equal(unlimited.current,'150.000 mA');
  assert.match(unlimited.notes,/No resistor limits/);
  console.log('PASS: no-resistor LED topology raises explicit current-limiting warning');
  const addedLed=await evaluate("(()=>{document.querySelector('#wiring-add-led').click();return {added:!!document.querySelector('[data-part-id=D2]'),stored:JSON.parse(localStorage.getItem('phi-circuit-lab-wiring-v1')).leds.length}})()");
  assert.equal(addedLed.added,true);
  assert.equal(addedLed.stored,2);
  console.log('PASS: component palette and local persistence include LEDs');
  assert.deepEqual(exceptions,[]);
  console.log('PASS: no uncaught browser JavaScript exceptions');
} finally {
  // Chrome may still write into its profile for a moment after SIGTERM.
  // Wait for process exit, then retry removal. A cleanup race is not a
  // failed circuit test (the runner removes its temporary directory anyway).
  if(chrome.exitCode===null){
    chrome.kill('SIGTERM');
    await Promise.race([
      new Promise(resolve=>chrome.once('exit',resolve)),
      new Promise(resolve=>setTimeout(resolve,2500))
    ]);
  }
  await new Promise(resolve=>server.close(resolve));
  try{await rm(profile,{recursive:true,force:true,maxRetries:15,retryDelay:100});}
  catch(error){console.warn('Chrome temporary-profile cleanup warning:',error.code);}
}
