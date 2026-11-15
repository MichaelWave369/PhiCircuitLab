/**
 * Φ Circuit Lab v0.9: exact first-order, time-dependent RC signal model.
 *
 * This simulator covers ONE ideal series R-C low-pass network with a
 * piecewise-constant voltage source. It does not add capacitors to the
 * arbitrary Wiring Lab nodal solver, and is not SPICE.
 *
 * Governing equation: C dVc/dt = (Vsource - Vc)/R.
 * Between input edges, the analytic update is:
 * Vc(t+dt) = Vsource + [Vc(t)-Vsource] exp(-dt/RC).
 * Edge times are integrated exactly before plotting or sampling.
 */
export const SCOPE_SAMPLES = 501;
export const DEFAULT_SCOPE_CONFIG=Object.freeze({
  waveform:'step',supplyV:5,resistanceOhms:1000,capacitanceMicroF:100,
  initialV:0,windowTau:8,pulseWidthTau:2,periodTau:4,dutyPercent:50
});

function finiteBetween(value,min,max,name){
  if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)
    throw new RangeError(name+' must be finite from '+min+' to '+max);
  return value;
}
export function validateScopeConfig(input){
  if(!input||typeof input!=='object'||Array.isArray(input))
    throw new TypeError('Scope settings must be an object');
  const waveform=input.waveform;
  if(!['step','pulse','square'].includes(waveform))
    throw new RangeError('Waveform must be step, pulse, or square');
  return {
    waveform,
    supplyV:finiteBetween(input.supplyV,0,12,'Source amplitude'),
    resistanceOhms:finiteBetween(input.resistanceOhms,100,1000000,'Resistance'),
    capacitanceMicroF:finiteBetween(input.capacitanceMicroF,1,1000,'Capacitance in microfarads'),
    initialV:finiteBetween(input.initialV,0,12,'Initial capacitor voltage'),
    windowTau:finiteBetween(input.windowTau,2,24,'Time window'),
    pulseWidthTau:finiteBetween(input.pulseWidthTau,.25,12,'Pulse width'),
    periodTau:finiteBetween(input.periodTau,1,12,'Square period'),
    dutyPercent:finiteBetween(input.dutyPercent,10,90,'Square duty cycle')
  };
}
export const scopeTauSeconds=cfg=>cfg.resistanceOhms*cfg.capacitanceMicroF*1e-6;

export function sourceEdges(validConfig){
  const cfg=validateScopeConfig(validConfig),tau=scopeTauSeconds(cfg);
  const duration=cfg.windowTau*tau;
  const result=[];
  if(cfg.waveform==='pulse'){
    const t=cfg.pulseWidthTau*tau;
    if(t>0&&t<=duration)result.push({timeSeconds:t,levelAfterV:0});
  }else if(cfg.waveform==='square'){
    const period=cfg.periodTau*tau;
    const on=period*(cfg.dutyPercent/100);
    for(let cycle=0;cycle<=Math.ceil(duration/period);cycle++){
      const falling=cycle*period+on;
      const rising=(cycle+1)*period;
      if(falling>0&&falling<=duration)result.push({timeSeconds:falling,levelAfterV:0});
      if(rising>0&&rising<=duration)result.push({timeSeconds:rising,levelAfterV:cfg.supplyV});
    }
  }
  return result.sort((a,b)=>a.timeSeconds-b.timeSeconds);
}
function advance(v,source,dt,tau){
  // -expm1 preserves precision for dt much smaller than RC.
  return v+(source-v)*(-Math.expm1(-dt/tau));
}
function sampler(cfg,edges){
  const tau=scopeTauSeconds(cfg);
  let t=0,vc=cfg.initialV,level=cfg.supplyV,edgeIndex=0;
  return target=>{
    if(target<t-1e-10*Math.max(1,tau))throw new RangeError('Samples must advance forward');
    while(edgeIndex<edges.length&&edges[edgeIndex].timeSeconds<=target+1e-13*tau){
      const edge=edges[edgeIndex++];
      const dt=Math.max(0,edge.timeSeconds-t);
      vc=advance(vc,level,dt,tau);
      t=edge.timeSeconds;
      level=edge.levelAfterV;
    }
    const dt=Math.max(0,target-t);
    vc=advance(vc,level,dt,tau);
    t=Math.max(t,target);
    return {
      timeSeconds:target,
      sourceV:level,
      capacitorV:vc,
      resistorV:level-vc,
      currentA:(level-vc)/cfg.resistanceOhms,
      energyJ:.5*cfg.capacitanceMicroF*1e-6*vc*vc
    };
  };
}
export function scopeSampleAt(input,timeSeconds){
  const cfg=validateScopeConfig(input),duration=scopeTauSeconds(cfg)*cfg.windowTau;
  finiteBetween(timeSeconds,0,duration,'Probe time');
  return sampler(cfg,sourceEdges(cfg))(timeSeconds);
}
export function simulateScope(input){
  const config=validateScopeConfig(input);
  const tauSeconds=scopeTauSeconds(config);
  const durationSeconds=tauSeconds*config.windowTau;
  const edges=sourceEdges(config);
  const sample=sampler(config,edges);
  const samples=Array.from({length:SCOPE_SAMPLES},(_,i)=>
    sample(durationSeconds*i/(SCOPE_SAMPLES-1)));
  const sampleDt=durationSeconds/(SCOPE_SAMPLES-1);
  const notes=[];
  const minSegmentSeconds=config.waveform==='square'?
    config.periodTau*tauSeconds*Math.min(config.dutyPercent/100,1-config.dutyPercent/100):
    config.waveform==='pulse'?config.pulseWidthTau*tauSeconds:Infinity;
  if(sampleDt>minSegmentSeconds/10)
    notes.push('Screen sample spacing is coarse relative to an input segment. Edges are still integrated exactly, but narrow features may look sparse.');
  if(config.initialV>config.supplyV)
    notes.push('The capacitor starts above the source amplitude; reverse resistor current is possible during discharge.');
  notes.push('Ideal one-resistor/one-capacitor circuit only. No parasitics, ESR, inductance, loading or component tolerances.');
  return {
    config,tauSeconds,durationSeconds,sampleDt,edges,samples,
    timeTo632Seconds:tauSeconds,
    riseTime1090Seconds:Math.log(9)*tauSeconds,
    notes
  };
}
export function scopeCursorPair(trace,fractionA,fractionB){
  finiteBetween(fractionA,0,1,'Cursor A position');
  finiteBetween(fractionB,0,1,'Cursor B position');
  const a=scopeSampleAt(trace.config,trace.durationSeconds*fractionA);
  const b=scopeSampleAt(trace.config,trace.durationSeconds*fractionB);
  return {
    a,b,deltaTimeSeconds:b.timeSeconds-a.timeSeconds,
    deltaCapacitorV:b.capacitorV-a.capacitorV
  };
}
export function scopeCsv(trace){
  const cols=['time_s','source_v','capacitor_v','resistor_v','current_a','energy_j'];
  return cols.join(',')+'\n'+trace.samples.map(p=>[
    p.timeSeconds,p.sourceV,p.capacitorV,p.resistorV,p.currentA,p.energyJ
  ].map(v=>v.toPrecision(12)).join(',')).join('\n')+'\n';
}
