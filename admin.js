import {initTeacherLab} from './teacher-lab.js?v=86';
import {adminLogin,adminCurrent,firebaseEnabled,ADMIN_EMAIL,watchAdminVirtualCreditRequests,reviewVirtualCreditRequest,watchAdminVirtualWithdrawalRequests,reviewVirtualWithdrawalRequest,watchAdminVirtualPlanRequests,reviewVirtualPlanRequest,watchAdminVirtualEarningsSummaries} from './backend.js?v=85';
const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
let firebase=null,sessions=[],selectedId=null,events=[],offSessions=()=>{},offEvents=()=>{},offScenario=()=>{},offLinks=()=>{},offCreditRequests=()=>{},offWithdrawalRequests=()=>{},offPlanRequests=()=>{},offEarningSummaries=()=>{},earningSummaries={},linksMap={},creditRequests=[],withdrawalRequests=[],planRequests=[],stage=0;
const date=x=>x?.toDate?x.toDate():null;
const money=n=>Number(n).toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})+' USDT';
const knownAmounts=['deposit_confirmed','plan_assign','withdraw_attempt','referral_credit'];
const eventAmount=e=>{if(!knownAmounts.includes(String(e.type||'')))return null;const m=String(e.label||'').match(/(\d+(?:[.,]\d{1,2})?)\s*USDT/i);return m?Number(m[1].replace(',','.')):null;};
const emptyDisplay=x=>String(x??'').trim()||'—';
function addText(tag,content,className){const node=document.createElement(tag);node.textContent=content;if(className)node.className=className;return node;}
function csvCell(value){let text=String(value??'');if(/^[\s\u0000-\u001f]*[=+@-]/.test(text))text="'"+text;return '"'+text.replace(/"/g,'""')+'"';}
function downloadCsv(filename,columns,rows){
 const lines=[columns,...rows].map(row=>row.map(csvCell).join(','));
 const blob=new Blob(['\ufeff'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'});
 const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function getVisibleStudents(){const q=$('#studentSearch').value.trim().toLocaleLowerCase('es');const filter=$('#studentFilter').value;
 return sessions.filter(s=>{
  const haystack=[s.alias,s.email,s.id,s.group].join(' ').toLocaleLowerCase('es');
  if(q&&!haystack.includes(q))return false;
  if(filter==='recent'&&!(date(s.lastSeen)&&Date.now()-date(s.lastSeen).getTime()<300000))return false;
  if(filter==='linked'&&!linksMap[s.id]&&!Object.values(linksMap).includes(s.id))return false;
  return true;
 });
}
function filteredEvents(){const f=$('#eventTypeFilter').value;return events.filter(e=>f==='all'||(f==='other'?!knownAmounts.includes(String(e.type||'')):String(e.type||'')===f));}
function countDescendants(uid){
 const children=(parent)=>Object.keys(linksMap).filter(child=>linksMap[child]===parent);
 const first=children(uid);const second=first.flatMap(children);const third=second.flatMap(children);
 return [new Set(first).size,new Set(second).size,new Set(third).size];
}
function renderStudentSummary(){
 const container=$('#studentSummary');container.replaceChildren();
 const s=sessions.find(x=>x.id===selectedId);if(!s){container.append(addText('p','Selecciona un alumno para consultar los datos disponibles.','muted'));return;}
 const wrapper=addText('div','','admin-profile-grid');
 const [l1,l2,l3]=countDescendants(s.id);
 const details=[['Nombre declarado',emptyDisplay(s.alias)],['Correo de contacto',emptyDisplay(s.email)],['Registro',shortDate(s.createdAt)],['Última actividad',shortDate(s.lastSeen)],['Vinculado a',linksMap[s.id]?studentName(linksMap[s.id]):'Sin vínculo'],['Referidos directos',String(l1)],['Segundo nivel',String(l2)],['Tercer nivel',String(l3)]];
 for(const [label,value] of details){const field=addText('div','','admin-profile-field');field.append(addText('small',label),addText('strong',value));wrapper.append(field);}
 container.append(wrapper);
 const titles=[['deposit_confirmed','Aportes ficticios registrados'],['plan_assign','Capital asignado (eventos)'],['withdraw_attempt','Retiros solicitados (eventos)'],['referral_credit','Bonos simulados registrados']];
 const metrics=addText('div','','admin-event-metrics');
 for(const [type,label] of titles){const matching=events.filter(e=>e.type===type);const amounts=matching.map(eventAmount).filter(v=>v!==null&&Number.isFinite(v));const val=amounts.length?money(amounts.reduce((a,b)=>a+b,0)):'—';
 const item=addText('div','','admin-metric');item.append(addText('small',label),addText('strong',val),addText('span',`${matching.length} evento(s) registrado(s)`,'tiny'));metrics.append(item);}
 container.append(metrics);
 const estimate=earningSummaries[selectedId];
 if(estimate){const metrics2=addText('div','','admin-event-metrics');for(const [label,amount] of [['Rendimiento ficticio pendiente',estimate.unpaidPlanYield],['Bonos por referidos pendientes',estimate.referralAvailable],['Ganancia disponible · declarada',estimate.availableToRequest],['Días para el ciclo',estimate.daysRemaining]]){const el=addText('div','','admin-metric');el.append(addText('small',label),addText('strong',label==='Días para el ciclo'?String(amount):money(amount)));metrics2.append(el);}container.append(metrics2);container.append(addText('p','Resumen enviado desde el navegador del alumno; no es un saldo verificado en servidor ni prueba de pago. Actualizado: '+shortDate(estimate.updatedAt),'tiny'));}
 const note=addText('p','Los importes de eventos pueden ser parciales; el resumen de ganancias, si aparece, es informativo y fue calculado por el navegador del alumno, NO un saldo auditado ni comprobación de fondos. Todo es ficticio.','admin-summary-note');container.append(note);
}


// V5 · Bandeja de solicitudes de crédito exclusivamente ficticio, en tiempo real.
function renderAdminCreditRequests(){
 const list=$('#creditApprovalList');list.replaceChildren();
 const pending=creditRequests.filter(x=>x.status==='pending');
 $('#pendingApprovals').textContent=String(pending.length);
 $('#approvalsSummary').textContent=pending.length?`${pending.length} solicitud(es) pendientes de revisión · Actualización en vivo`:'No hay solicitudes pendientes. Las nuevas aparecerán aquí automáticamente.';
 const recent=[...creditRequests].sort((a,b)=>{
  if(a.status==='pending'&&b.status!=='pending')return -1;
  if(b.status==='pending'&&a.status!=='pending')return 1;
  return (b.createdAt?.seconds||0)-(a.createdAt?.seconds||0);
 }).slice(0,40);
 if(!recent.length){list.append(addText('p','Todavía no hay solicitudes de práctica.','muted'));return;}
 for(const r of recent){
  const row=addText('div','','admin-approval-row');
  const detail=document.createElement('div');detail.className='admin-approval-detail';
  const uid=r.studentUid||'';const name=studentName(uid)||r.studentAlias||'Alumno';
  detail.append(addText('strong',name),addText('p',`${money(r.amount)} ficticios · ${shortDate(r.createdAt)}`,'tiny'));
  const state=addText('span',r.status==='approved'?'Aprobada':r.status==='rejected'?'Rechazada':'Pendiente de revisión','tag '+(r.status==='pending'?'warn':r.status==='rejected'?'danger':''));
  row.append(detail,state);
  if(r.status==='pending'){
   for(const [decision,caption,variant] of [['approved','Aprobar','btn-primary'],['rejected','Rechazar','btn-soft']]){
    const b=document.createElement('button');b.type='button';b.className='btn '+variant;b.textContent=caption;
    b.addEventListener('click',async()=>{
      const action=decision==='approved'?'aprobar':'rechazar';
      if(!window.confirm(`¿Confirmas ${action} ${money(r.amount)} ficticios para ${name}? Esta acción no puede deshacerse.`))return;
      row.querySelectorAll('button').forEach(button=>button.disabled=true);
      $('#approvalsMessage').textContent='Guardando decisión…';
      try{await reviewVirtualCreditRequest(firebase,r.id,decision);$('#approvalsMessage').textContent='Decisión guardada. El alumno verá el cambio en su panel al estar conectado.';}
      catch(e){$('#approvalsMessage').textContent='No se pudo guardar: '+e.message;row.querySelectorAll('button').forEach(button=>button.disabled=false);}
    });row.append(b);
   }
  }
  list.append(row);
 }
}

// V8.3 · Panel de aprobaciones de PLAN: aprobar activa el plan seleccionado,
// no genera saldo libre. Todo se ejecuta exclusivamente con cantidades demo.
function renderAdminPlanRequests(){
 const list=$('#planApprovalList');if(!list)return;list.replaceChildren();
 const pending=planRequests.filter(r=>r.status==='pending');
 $('#pendingPlanApprovals').textContent=String(pending.length);
 $('#planApprovalsSummary').textContent=pending.length?`${pending.length} activación(es) pendiente(s) · En vivo`:'No hay nuevas activaciones pendientes.';
 const rows=[...planRequests].sort((a,b)=>{
  if(a.status==='pending'&&b.status!=='pending')return -1;
  if(b.status==='pending'&&a.status!=='pending')return 1;
  return (date(b.createdAt)?.getTime()||0)-(date(a.createdAt)?.getTime()||0);
 }).slice(0,40);
 if(!rows.length){list.append(addText('p','Todavía no hay activaciones de planes ficticios.','muted'));return;}
 for(const r of rows){
  const row=addText('div','','admin-approval-row'),detail=addText('div','','admin-approval-detail');
  const name=sessions.find(s=>s.id===r.studentUid)?.alias||r.studentAlias||'Alumno';
  detail.append(addText('strong',name),addText('p',`Plan: ${r.plan} · ${money(r.amount)} DEMO · ${shortDate(r.createdAt)}`,'tiny'));
  const state=addText('span',r.status==='approved'?'Aprobada · plan activado':r.status==='rejected'?'Rechazada':'Pendiente','tag '+(r.status==='pending'?'warn':r.status==='rejected'?'danger':''));
  row.append(detail,state);
  if(r.status==='pending')for(const [decision,label,klass] of [['approved','Aprobar','btn-primary'],['rejected','Rechazar','btn-soft']]){
   const btn=addText('button',label,'btn '+klass);btn.type='button';
   btn.addEventListener('click',async()=>{
    if(!window.confirm(`¿${decision==='approved'?'Activar':'Rechazar'} el plan ${r.plan} (${money(r.amount)} DEMO) para ${name}? No se mueve dinero real.`))return;
    row.querySelectorAll('button').forEach(x=>x.disabled=true);
    $('#planApprovalsMessage').textContent='Guardando decisión…';
    try{await reviewVirtualPlanRequest(firebase,r.id,decision);$('#planApprovalsMessage').textContent='Decisión guardada; el alumno verá la activación o el rechazo en su panel.';}
    catch(e){$('#planApprovalsMessage').textContent='Error: '+e.message;row.querySelectorAll('button').forEach(x=>x.disabled=false);}
   });row.append(btn);
  }
  list.append(row);
 }
}

// V6 · Las solicitudes de retiro se reciben por Firestore y sólo el administrador puede decidir.
function renderAdminWithdrawalRequests(){
 const list=$('#withdrawalApprovalList');list.replaceChildren();
 const pend=withdrawalRequests.filter(x=>x.status==='pending');
 $('#pendingWithdrawals').textContent=String(pend.length);
 $('#withdrawalApprovalsSummary').textContent=pend.length?`${pend.length} solicitud(es) de retiro pendiente(s) · En vivo`:'No hay retiros ficticios pendientes. Las solicitudes aparecerán aquí automáticamente.';
 const recent=[...withdrawalRequests].sort((a,b)=>{
  if(a.status==='pending'&&b.status!=='pending')return -1;
  if(b.status==='pending'&&a.status!=='pending')return 1;
  return (date(b.createdAt)?.getTime()||0)-(date(a.createdAt)?.getTime()||0);
 }).slice(0,40);
 if(!recent.length){list.append(addText('p','Todavía no hay solicitudes de retiro de práctica.','muted'));return;}
 for(const r of recent){
  const row=addText('div','','admin-approval-row');const detail=addText('div','','admin-approval-detail');
  const name=sessions.find(s=>s.id===r.studentUid)?.alias||r.studentAlias||'Alumno';
  const summary=earningSummaries[r.studentUid];
  const info=summary?` · Ganancias declaradas: ${money(summary.availableToRequest)} · ${summary.daysRemaining} días del ciclo restantes`:' · Saldo informativo del alumno todavía no sincronizado';
  detail.append(addText('strong',name),addText('p',`${money(r.amount)} ficticios · ${shortDate(r.createdAt)}${info}`,'tiny'));
  const state=addText('span',r.status==='approved'?'Aprobada':r.status==='rejected'?'Rechazada':'Pendiente de revisión','tag '+(r.status==='pending'?'warn':r.status==='rejected'?'danger':''));
  row.append(detail,state);
  if(r.status==='pending')for(const [decision,caption,variant] of [['approved','Aprobar','btn-primary'],['rejected','Rechazar','btn-soft']]){
   const b=document.createElement('button');b.type='button';b.className='btn '+variant;b.textContent=caption;
   b.addEventListener('click',async()=>{
    const action=decision==='approved'?'aprobar':'rechazar';
    if(!window.confirm(`¿Confirmas ${action} el retiro FICTICIO de ${money(r.amount)} para ${name}? No se transfiere dinero.`))return;
    row.querySelectorAll('button').forEach(button=>button.disabled=true);
    $('#withdrawalApprovalsMessage').textContent='Guardando la decisión…';
    try{await reviewVirtualWithdrawalRequest(firebase,r.id,decision);$('#withdrawalApprovalsMessage').textContent='Decisión registrada. El alumno verá el nuevo estado al conectarse.';}
    catch(e){$('#withdrawalApprovalsMessage').textContent='Error al guardar la decisión: '+e.message;row.querySelectorAll('button').forEach(button=>button.disabled=false);}
   });row.append(b);
  }
  list.append(row);
 }
}

const shortDate=x=>{const d=date(x);return d?d.toLocaleString('es-ES',{dateStyle:'short',timeStyle:'short'}):'—';};
function setError(s){$('#loginError').textContent=s;}
function teacherReady(f){
 firebase=f;$('#adminGate').classList.add('hidden');$('#adminContent').classList.remove('hidden');$('#logoutAdmin').classList.remove('hidden');
 $('#adminIdentity').textContent=f.auth.currentUser.email;initTeacherLab();watch();
}
function watch(){
 const {db,Store}=firebase;
 offSessions();offScenario();offLinks();offCreditRequests();offWithdrawalRequests();offPlanRequests();offEarningSummaries();
    offCreditRequests=watchAdminVirtualCreditRequests(firebase,rows=>{creditRequests=rows;renderAdminCreditRequests();},e=>{$('#approvalsMessage').textContent='Error de permisos o conexión al leer solicitudes: '+e.message;});
    offPlanRequests=watchAdminVirtualPlanRequests(firebase,rows=>{planRequests=rows;renderAdminPlanRequests();},e=>{$('#planApprovalsMessage').textContent='No se pudieron leer activaciones: '+e.message;});
 offWithdrawalRequests=watchAdminVirtualWithdrawalRequests(firebase,rows=>{withdrawalRequests=rows;renderAdminWithdrawalRequests();},e=>{$('#withdrawalApprovalsMessage').textContent='Error de permisos o conexión al leer retiros ficticios: '+e.message;});
 offEarningSummaries=watchAdminVirtualEarningsSummaries(firebase,rows=>{earningSummaries=Object.fromEntries(rows.map(r=>[r.id,r]));renderAdminWithdrawalRequests();if(selectedId)renderStudentSummary();},e=>{$('#withdrawalApprovalsMessage').textContent='Resumen de ganancias sin sincronizar: '+e.message;});
 offLinks=Store.onSnapshot(Store.collection(db,'referralLinks'),snap=>{linksMap={};snap.docs.forEach(d=>linksMap[d.id]=d.data().inviterUid);renderLinks();refreshStudents();if(selectedId){showSelectedProfile();renderStudentSummary();}},err=>console.warn('No se pudo listar la red del aula',err));
 offSessions=Store.onSnapshot(Store.query(Store.collection(db,'sessions'),Store.orderBy('lastSeen','desc'),Store.limit(200)),snap=>{
   sessions=snap.docs.map(d=>({id:d.id,...d.data()}));
   $('#connectionBadge').textContent='Sincronizado';refreshStudents();renderLinks();if(selectedId){showSelectedProfile();renderStudentSummary();}
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
 const visible=getVisibleStudents();$('#studentResults').textContent=`${visible.length} de ${sessions.length} sesiones`;
 $('#exportStudents').disabled=!visible.length;
 if(!visible.length){list.append(addText('p',sessions.length?'No hay alumnos que coincidan con el filtro.':'Todavía no hay sesiones registradas.','muted'));return;}
 visible.forEach(s=>{
   const b=document.createElement('button');b.className='admin-item'+(s.id===selectedId?' active':'');
   const d=document.createElement('div'),name=document.createElement('b'),meta=document.createElement('div'),last=document.createElement('small');
   name.textContent=s.alias||'Alumno sin nombre';meta.className='tiny';meta.textContent=(s.view||'resumen')+' · '+(s.lastAction||'Acceso al panel');
   d.append(name,meta);last.textContent=shortDate(s.lastSeen);b.append(d,last);b.addEventListener('click',()=>select(s.id));list.append(b);
 });
 if(selectedId&&!sessions.find(s=>s.id===selectedId)){selectedId=null;events=[];offEvents();$('#selectedStudent').textContent='Selecciona un alumno';$('#studentProfile').textContent='';$('#withdrawCount').textContent='0';renderStudentSummary();}
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
 selectedId=uid;events=[];offEvents();$('#withdrawCount').textContent='0';$('#eventTypeFilter').value='all';
 const s=sessions.find(x=>x.id===uid);$('#selectedStudent').textContent=s?.alias||uid;showSelectedProfile();
 refreshStudents();renderStudentSummary();$('#eventResults').textContent='Cargando eventos…';$('#activityRows').innerHTML='<tr><td colspan="3">Cargando actividad…</td></tr>';
 $('#exportCsv').disabled=true;
 const {db,Store}=firebase;
 offEvents=Store.onSnapshot(Store.query(Store.collection(db,'sessions',uid,'events'),Store.orderBy('createdAt','desc'),Store.limit(200)),snap=>{
   events=snap.docs.map(d=>d.data());renderEvents();renderStudentSummary();
 },err=>{$('#activityRows').innerHTML='<tr><td colspan="3">No se pudo acceder a esta actividad.</td></tr>';$('#eventResults').textContent='Error de lectura de la actividad';console.error(err);});
}
function renderEvents(){
 const table=$('#activityRows');table.replaceChildren();const visible=filteredEvents();$('#exportCsv').disabled=!visible.length;
 $('#withdrawCount').textContent=String(events.filter(x=>x.type==='withdraw_attempt').length);
 $('#eventResults').textContent=`Mostrando ${visible.length} de ${events.length} eventos cargados (hasta 200)`;
 if(!visible.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=3;td.textContent=events.length?'No hay acciones de este tipo.':'Este alumno aún no tiene acciones registradas.';tr.append(td);table.append(tr);return;}
 for(const e of visible){const tr=document.createElement('tr');for(const text of [shortDate(e.createdAt),String(e.view||'—'),String(e.label||'—')]){const td=document.createElement('td');td.textContent=text;tr.append(td);}table.append(tr);}
}
$$('[data-stage]').forEach(b=>b.addEventListener('click',async()=>{
 if(!firebase)return;const next=Number(b.dataset.stage);b.disabled=true;
 try{await firebase.Store.setDoc(firebase.Store.doc(firebase.db,'control','global'),{stage:next,updatedAt:firebase.Store.serverTimestamp(),updatedBy:ADMIN_EMAIL});$('#scenarioStatus').textContent='Escenario actualizado para la clase.';}
 catch(e){$('#scenarioStatus').textContent='Error al actualizar: '+e.message;}
 finally{b.disabled=false;}
}));
$('#refreshAdmin').addEventListener('click',()=>{refreshStudents();if(selectedId)renderEvents();});
$('#studentSearch').addEventListener('input',refreshStudents);
$('#studentFilter').addEventListener('change',refreshStudents);
$('#eventTypeFilter').addEventListener('change',renderEvents);
$('#exportStudents').addEventListener('click',()=>{
 const visible=getVisibleStudents();
 downloadCsv('invest-capital-alumnos-simulacion.csv',['Alumno','Correo declarado','Grupo','Fecha de registro','Ultima actividad','Vinculado a','Referidos nivel 1','Nivel 2','Nivel 3'],visible.map(s=>{
 const counts=countDescendants(s.id);return[s.alias||'',s.email||'',s.group||'',shortDate(s.createdAt),shortDate(s.lastSeen),linksMap[s.id]?studentName(linksMap[s.id]):'',...counts];
 }));
});
$('#exportCsv').addEventListener('click',()=>{
 const s=sessions.find(x=>x.id===selectedId);
 downloadCsv('invest-capital-actividad-'+(s?.alias||'alumno').replace(/[^a-z0-9-_]/gi,'_')+'.csv',
 ['Fecha','Seccion','Accion','Tipo','Importe ficticio USDT (si consta)'],filteredEvents().map(e=>[shortDate(e.createdAt),e.view,e.label,e.type,eventAmount(e)??'']));
});
$('#loginAdmin').addEventListener('click',async()=>{
 setError('');const b=$('#loginAdmin');b.disabled=true;b.textContent='Verificando cuenta…';
 try{teacherReady(await adminLogin());}catch(e){setError('Acceso no autorizado o error de inicio de sesión: '+e.message);}
 finally{b.disabled=false;b.textContent='Acceder con Google';}
});
$('#logoutAdmin').addEventListener('click',async()=>{offSessions();offEvents();offScenario();offLinks();offCreditRequests();offWithdrawalRequests();offPlanRequests();offEarningSummaries();if(firebase)await firebase.Auth.signOut(firebase.auth);location.reload();});
(async()=>{
 if(!firebaseEnabled){setError('El seguimiento remoto todavía no está activado. Configura Firebase siguiendo INSTRUCCIONES.md.');return;}
 try{const f=await adminCurrent();if(f)teacherReady(f);}catch(e){setError('No se pudo comprobar la sesión: '+e.message);}
})();
window.addEventListener('pagehide',()=>{offSessions();offEvents();offScenario();offLinks();offCreditRequests();offWithdrawalRequests();offPlanRequests();offEarningSummaries();});
