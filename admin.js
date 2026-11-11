import {adminLogin,adminCurrent,firebaseEnabled,ADMIN_EMAIL} from './backend.js';
const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
let firebase=null,sessions=[],selectedId=null,events=[],offSessions=()=>{},offEvents=()=>{},offScenario=()=>{},offLinks=()=>{},linksMap={},stage=0;
const date=x=>x?.toDate?x.toDate():null;
const shortDate=x=>{const d=date(x);return d?d.toLocaleString('es-ES',{dateStyle:'short',timeStyle:'short'}):'—';};
function setError(s){$('#loginError').textContent=s;}
function teacherReady(f){
 firebase=f;$('#adminGate').classList.add('hidden');$('#adminContent').classList.remove('hidden');$('#logoutAdmin').classList.remove('hidden');
 $('#adminIdentity').textContent=f.auth.currentUser.email;watch();
}
function watch(){
 const {db,Store}=firebase;
 offSessions();offScenario();offLinks();
 offLinks=Store.onSnapshot(Store.collection(db,'referralLinks'),snap=>{linksMap={};snap.docs.forEach(d=>linksMap[d.id]=d.data().inviterUid);renderLinks();if(selectedId)showSelectedProfile();},err=>console.warn('No se pudo listar la red del aula',err));
 offSessions=Store.onSnapshot(Store.query(Store.collection(db,'sessions'),Store.orderBy('lastSeen','desc'),Store.limit(200)),snap=>{
   sessions=snap.docs.map(d=>({id:d.id,...d.data()}));
   $('#connectionBadge').textContent='Sincronizado';refreshStudents();renderLinks();
 },err=>{$('#connectionBadge').textContent='Error de lectura';console.error(err);});
 offScenario=Store.onSnapshot(Store.doc(db,'control','global'),snap=>{
   stage=snap.exists()?Number(snap.data().stage)||0:0;
   $('#scenarioLabel').textContent=['Normal','Crecimiento','Validaciones','Suspendido'][stage]||'Normal';
   $$('[data-stage]').forEach(b=>b.classList.toggle('btn-primary',+b.dataset.stage===stage));
 },err=>{$('#scenarioStatus').textContent='No se pudo leer el escenario: '+err.message;});
}
function refreshStudents(){
 $('#sessionsCount').textContent=String(sessions.length);
 $('#activeCount').textContent=String(sessions.filter(x=>date(x.lastSeen)&&Date.now()-date(x.lastSeen).getTime()<300000).length);
 // El contador corresponde solo a los eventos cargados del alumno seleccionado.
 $('#withdrawCount').textContent=String(events.filter(x=>x.type==='withdraw_attempt').length);
 const list=$('#studentList');list.replaceChildren();
 if(!sessions.length){list.innerHTML='<p class="muted">Todavía no hay sesiones registradas.</p>';return;}
 sessions.forEach(s=>{
   const b=document.createElement('button');b.className='admin-item'+(s.id===selectedId?' active':'');
   const d=document.createElement('div'),name=document.createElement('b'),meta=document.createElement('div'),last=document.createElement('small');
   name.textContent=s.alias||'Alumno sin nombre';meta.className='tiny';meta.textContent=(s.view||'resumen')+' · '+(s.lastAction||'Acceso al panel');
   d.append(name,meta);last.textContent=shortDate(s.lastSeen);b.append(d,last);b.addEventListener('click',()=>select(s.id));list.append(b);
 });
 if(selectedId&&!sessions.find(s=>s.id===selectedId)){selectedId=null;events=[];offEvents();$('#selectedStudent').textContent='Selecciona un alumno';$('#studentProfile').textContent='';$('#withdrawCount').textContent='0';}
}

function studentName(uid){return sessions.find(s=>s.id===uid)?.alias||'Alumno '+String(uid).slice(0,6);}
function showSelectedProfile(){
 const s=sessions.find(x=>x.id===selectedId);if(!s)return;
 const invitedBy=linksMap[selectedId];
 $('#studentProfile').textContent=[s.group?'Grupo anterior: '+s.group:'',s.email?'Correo o teléfono (declarado): '+s.email:'',invitedBy?'Vinculado a: '+studentName(invitedBy):''].filter(Boolean).join(' · ')||'Sin datos adicionales';
}
function renderLinks(){
 const ids=Object.keys(linksMap);
 $('#linksCount').textContent=ids.length+' vínculos';
 const tbody=$('#linksRows');tbody.replaceChildren();
 if(!ids.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=4;td.textContent='Todavía no hay alumnos vinculados.';tr.append(td);tbody.append(tr);return;}
 for(const id of ids.slice(0,150)){
  const chain=[];let parent=linksMap[id];const seen=new Set([id]);
  while(parent && !seen.has(parent) && chain.length<3){chain.push(parent);seen.add(parent);parent=linksMap[parent];}
  const tr=document.createElement('tr');
  for(const v of [id,...[0,1,2].map(i=>chain[i])]){const td=document.createElement('td');td.textContent=v?studentName(v):'—';tr.append(td);}
  tbody.append(tr);
 }
}

function select(uid){
 selectedId=uid;events=[];offEvents();$('#withdrawCount').textContent='0';
 const s=sessions.find(x=>x.id===uid);$('#selectedStudent').textContent=s?.alias||uid;showSelectedProfile();
 refreshStudents();$('#activityRows').innerHTML='<tr><td colspan="3">Cargando actividad…</td></tr>';
 $('#exportCsv').disabled=true;
 const {db,Store}=firebase;
 offEvents=Store.onSnapshot(Store.query(Store.collection(db,'sessions',uid,'events'),Store.orderBy('createdAt','desc'),Store.limit(200)),snap=>{
   events=snap.docs.map(d=>d.data());renderEvents();
 },err=>{$('#activityRows').innerHTML='<tr><td colspan="3">No se pudo acceder a esta actividad.</td></tr>';console.error(err);});
}
function renderEvents(){
 const table=$('#activityRows');table.replaceChildren();$('#exportCsv').disabled=!events.length;
 $('#withdrawCount').textContent=String(events.filter(x=>x.type==='withdraw_attempt').length);
 if(!events.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=3;td.textContent='Este alumno aún no tiene acciones registradas.';tr.append(td);table.append(tr);return;}
 for(const e of events){const tr=document.createElement('tr');for(const text of [shortDate(e.createdAt),String(e.view||'—'),String(e.label||'—')]){const td=document.createElement('td');td.textContent=text;tr.append(td);}table.append(tr);}
}
$$('[data-stage]').forEach(b=>b.addEventListener('click',async()=>{
 if(!firebase)return;const next=Number(b.dataset.stage);b.disabled=true;
 try{await firebase.Store.setDoc(firebase.Store.doc(firebase.db,'control','global'),{stage:next,updatedAt:firebase.Store.serverTimestamp(),updatedBy:ADMIN_EMAIL});$('#scenarioStatus').textContent='Escenario actualizado para la clase.';}
 catch(e){$('#scenarioStatus').textContent='Error al actualizar: '+e.message;}
 finally{b.disabled=false;}
}));
$('#refreshAdmin').addEventListener('click',()=>{refreshStudents();if(selectedId)renderEvents();});
$('#exportCsv').addEventListener('click',()=>{
 const s=sessions.find(x=>x.id===selectedId);
 const q=v=>'"'+String(v||'').replace(/"/g,'""')+'"';
 const lines=[['Fecha','Seccion','Accion'].map(q).join(','),...events.map(e=>[shortDate(e.createdAt),e.view,e.label].map(q).join(','))];
 const blob=new Blob(['\ufeff'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='actividad-'+(s?.alias||'alumno').replace(/[^a-z0-9-_]/gi,'_')+'.csv';a.click();URL.revokeObjectURL(url);
});
$('#loginAdmin').addEventListener('click',async()=>{
 setError('');const b=$('#loginAdmin');b.disabled=true;b.textContent='Verificando cuenta…';
 try{teacherReady(await adminLogin());}catch(e){setError('Acceso no autorizado o error de inicio de sesión: '+e.message);}
 finally{b.disabled=false;b.textContent='Acceder con Google';}
});
$('#logoutAdmin').addEventListener('click',async()=>{offSessions();offEvents();offScenario();offLinks();if(firebase)await firebase.Auth.signOut(firebase.auth);location.reload();});
(async()=>{
 if(!firebaseEnabled){setError('El seguimiento remoto todavía no está activado. Configura Firebase siguiendo INSTRUCCIONES.md.');return;}
 try{const f=await adminCurrent();if(f)teacherReady(f);}catch(e){setError('No se pudo comprobar la sesión: '+e.message);}
})();
window.addEventListener('pagehide',()=>{offSessions();offEvents();offScenario();offLinks();});
