/**
 * Φ Circuit Lab v1.0 • offline project portfolio.
 * No network, account, paid packages, executable imports or shared lab writes.
 * Each project owns an independent validated DC circuit, a separate ideal RC
 * scope experiment, and a bounded, plain-text laboratory notebook.
 */
import {presetCircuit,validateCircuit} from './wiring-solver.mjs';
import {DEFAULT_SCOPE_CONFIG,validateScopeConfig} from './scope-engine.mjs';

export const WORKSTATION_STORAGE_KEY='phi-circuit-lab-workstation-v1';
export const MAX_WORKSTATION_PROJECTS=12;
export const MAX_WORKSTATION_NOTES=60;
export const MAX_WORKSTATION_NOTE_CHARS=500;
export const MAX_WORKSTATION_IMPORT_BYTES=150000;
const MAX_PROJECT_NAME_CHARS=60;
const OWN=(object,key)=>Object.prototype.hasOwnProperty.call(object,key);
const copy=x=>JSON.parse(JSON.stringify(x));

export function projectName(raw){
  if(typeof raw!=='string')throw new TypeError('Project name must be text');
  const name=raw.trim().replace(/\s+/g,' ');
  if(name.length<1||name.length>MAX_PROJECT_NAME_CHARS)
    throw new RangeError('Project name must contain 1–60 characters');
  if(/[\x00-\x1f\x7f]/.test(name))throw new RangeError('Control characters are not allowed');
  return name;
}
function newProject(id,name){
  return {id,name:projectName(name),circuit:presetCircuit('series'),
    scope:validateScopeConfig(DEFAULT_SCOPE_CONFIG),notes:[],nextNoteId:1};
}
export function newWorkstationLibrary(){
  return {version:1,activeId:'p1',nextProjectId:2,
    projects:[newProject('p1','My Electronics Bench')]};
}
function projectId(raw){
  if(typeof raw!=='string'||!/^p[1-9]\d{0,6}$/.test(raw))
    throw new RangeError('Invalid project identifier');
  return raw;
}
function noteId(raw){
  if(typeof raw!=='string'||!/^n[1-9]\d{0,6}$/.test(raw))
    throw new RangeError('Invalid notebook entry identifier');
  return raw;
}
function noteContent(value){
  if(typeof value!=='string')throw new TypeError('Notebook entry must be plain text');
  const clean=value.trim();
  if(clean.length<1||clean.length>MAX_WORKSTATION_NOTE_CHARS)
    throw new RangeError('Notebook entry must contain 1–500 characters');
  if(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(clean))
    throw new RangeError('Notebook entry contains a control character');
  return clean;
}
function normalizeEntry(input){
  if(!input||typeof input!=='object'||Array.isArray(input))
    throw new TypeError('Invalid notebook entry');
  const id=noteId(input.id);
  const source=input.source;
  if(!['manual','meter','scope'].includes(source))throw new RangeError('Invalid notebook source');
  return {id,source,text:noteContent(input.text)};
}
function normalizeProject(input){
  if(!input||typeof input!=='object'||Array.isArray(input))
    throw new TypeError('Invalid project record');
  if(!Array.isArray(input.notes)||input.notes.length>MAX_WORKSTATION_NOTES)
    throw new RangeError('Too many notebook entries');
  const notes=input.notes.map(normalizeEntry);
  if(new Set(notes.map(n=>n.id)).size!==notes.length)
    throw new RangeError('Duplicate notebook entry identifier');
  if(!Number.isSafeInteger(input.nextNoteId)||input.nextNoteId<1||
     input.nextNoteId>9999999)
    throw new RangeError('Invalid next notebook sequence');
  if(notes.some(n=>Number(n.id.slice(1))>=input.nextNoteId))
    throw new RangeError('Notebook sequence must exceed all existing entries');
  return {id:projectId(input.id),name:projectName(input.name),
    circuit:validateCircuit(input.circuit),
    scope:validateScopeConfig(input.scope),
    notes,nextNoteId:input.nextNoteId};
}
export function validateWorkstationLibrary(value){
  if(!value||typeof value!=='object'||Array.isArray(value)||value.version!==1)
    throw new RangeError('Unsupported workstation bundle version');
  if(!Array.isArray(value.projects)||value.projects.length<1||
     value.projects.length>MAX_WORKSTATION_PROJECTS)
    throw new RangeError('Workstation must contain 1–12 projects');
  const projects=value.projects.map(normalizeProject);
  if(new Set(projects.map(p=>p.id)).size!==projects.length)
    throw new RangeError('Duplicate project identifier');
  if(!Number.isSafeInteger(value.nextProjectId)||value.nextProjectId<1||
     value.nextProjectId>9999999||
     projects.some(p=>Number(p.id.slice(1))>=value.nextProjectId))
    throw new RangeError('Invalid next project sequence');
  if(!projects.some(p=>p.id===value.activeId))
    throw new RangeError('Active project missing');
  return {version:1,activeId:value.activeId,
    nextProjectId:value.nextProjectId,projects};
}
export function activeProject(library){
  const data=validateWorkstationLibrary(library);
  return data.projects.find(p=>p.id===data.activeId);
}
function edit(library,updater){
  const draft=validateWorkstationLibrary(library);
  updater(draft);
  return validateWorkstationLibrary(draft);
}
export function createWorkstationProject(library,name){
  return edit(library,draft=>{
    if(draft.projects.length>=MAX_WORKSTATION_PROJECTS)
      throw new RangeError('Workstation project capacity reached (12)');
    const id='p'+draft.nextProjectId++;
    draft.projects.push(newProject(id,name));
    draft.activeId=id;
  });
}
export function duplicateWorkstationProject(library){
  return edit(library,draft=>{
    if(draft.projects.length>=MAX_WORKSTATION_PROJECTS)
      throw new RangeError('Workstation project capacity reached (12)');
    const original=draft.projects.find(p=>p.id===draft.activeId);
    const dupe=copy(original);
    dupe.id='p'+draft.nextProjectId++;
    dupe.name=projectName((original.name.slice(0,53)+' copy'));
    draft.projects.push(dupe);
    draft.activeId=dupe.id;
  });
}
export function renameWorkstationProject(library,name){
  return edit(library,draft=>{
    draft.projects.find(p=>p.id===draft.activeId).name=projectName(name);
  });
}
export function selectWorkstationProject(library,id){
  return edit(library,draft=>{
    if(!draft.projects.some(p=>p.id===id))throw new RangeError('Project does not exist');
    draft.activeId=id;
  });
}
export function deleteWorkstationProject(library){
  return edit(library,draft=>{
    if(draft.projects.length===1)
      throw new RangeError('Keep at least one project in the Workstation');
    draft.projects=draft.projects.filter(p=>p.id!==draft.activeId);
    draft.activeId=draft.projects[0].id;
  });
}
export function updateWorkstationCircuit(library,circuit){
  const validated=validateCircuit(circuit);
  return edit(library,draft=>{draft.projects.find(p=>p.id===draft.activeId).circuit=validated;});
}
export function updateWorkstationScope(library,config){
  const validated=validateScopeConfig(config);
  return edit(library,draft=>{draft.projects.find(p=>p.id===draft.activeId).scope=validated;});
}
export function addWorkstationNote(library,source,text){
  if(!['manual','meter','scope'].includes(source))throw new RangeError('Unknown notebook source');
  const value=noteContent(text);
  return edit(library,draft=>{
    const project=draft.projects.find(p=>p.id===draft.activeId);
    if(project.notes.length>=MAX_WORKSTATION_NOTES)
      throw new RangeError('This project already contains 60 notebook entries');
    project.notes.push({id:'n'+project.nextNoteId++,source,text:value});
  });
}
export function deleteWorkstationNote(library,id){
  return edit(library,draft=>{
    const project=draft.projects.find(p=>p.id===draft.activeId);
    if(!project.notes.some(n=>n.id===id))throw new RangeError('Notebook entry not found');
    project.notes=project.notes.filter(n=>n.id!==id);
  });
}
export function exportWorkstationBundle(library){
  const valid=validateWorkstationLibrary(library);
  return JSON.stringify(valid,null,2)+'\n';
}
export function importWorkstationBundle(text){
  if(typeof text!=='string'||text.length>MAX_WORKSTATION_IMPORT_BYTES)
    throw new RangeError('Workstation bundle exceeds the import limit');
  return validateWorkstationLibrary(JSON.parse(text));
}
