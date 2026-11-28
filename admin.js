import {abrirDirectorio} from './admin-supabase.js';
import {adminLogin,adminCurrent,firebaseEnabled,ADMIN_EMAIL,watchAdminVirtualCreditRequests,reviewVirtualCreditRequest,watchAdminVirtualWithdrawalRequests,reviewVirtualWithdrawalRequest,watchAdminVirtualPlanRequests,reviewVirtualPlanRequest,watchAdminVirtualEarningsSummaries,watchAdminTeacherSettings,setAdminTeacherSettings} from './backend.js?v=93';
const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
let offTeacherSettings=()=>{},teacherSelectedUid='',teacherSettings={extraDays:0,bonus:0,plan:''};
let offStudentProfile=()=>{},studentProfileData=null,icProfileLoadState='idle';
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
// Resumen informativo de planes aprobados del usuario; no acredita pagos reales.
function planCurrency(r){
 const raw=String(r.currency||'').trim().toUpperCase();
 if(raw==='RUB'||raw==='RUB-DEMO'||raw==='₽')return 'RUB';
 if(raw==='USDT'||raw==='USDT-DEMO'||raw==='USDT-BEP20'||raw==='USDT-TRC20')return 'USDT';
 return raw||'No registrada';
}
function planMethod(r){
 const raw=String(r.paymentMethod||r.payment_method||r.method||r.network||'').trim();
 if(!raw)return 'No registrado';
 const val=raw.toUpperCase();
 if(val.includes('SBER'))return 'Sberbank';
 if(val.includes('BEP20')||val.includes('BSC'))return 'USDT-BEP20';
 if(val.includes('TRC20')||val.includes('TRON'))return 'USDT-TRC20';
 return raw.slice(0,65);
}
function renderStudentPlans(container,uid){
 const section=addText('section','','ic-student-plans');
 section.append(addText('h3','Planes del usuario · Registro de práctica'));
 const rows=planRequests.filter(r=>r.studentUid===uid&&r.status==='approved');
 const pending=planRequests.filter(r=>r.studentUid===uid&&r.status==='pending');
 const totals=new Map();
 for(const r of rows){const cur=planCurrency(r),amt=Number(r.amount);if(Number.isFinite(amt)&&amt>=0)totals.set(cur,(totals.get(cur)||0)+amt);}
 const summary=addText('div','','ic-student-plans-stats');
 const count=addText('div','','ic-student-plans-stat');count.append(addText('small','Planes aprobados'),addText('strong',String(rows.length)));summary.append(count);
 const wait=addText('div','','ic-student-plans-stat');wait.append(addText('small','Solicitudes pendientes'),addText('strong',String(pending.length)));summary.append(wait);
 for(const [cur,amount] of totals){const el=addText('div','','ic-student-plans-stat');el.append(addText('small','Capital aprobado · '+cur),addText('strong',Number(amount).toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})+' '+cur));summary.append(el);}
 section.append(summary);
 if(!rows.length){section.append(addText('p','No constan planes aprobados en los registros disponibles.','muted'));}
 else{
  const scroll=addText('div','','ic-student-plans-scroll'),table=addText('table','','ic-student-plans-table');
  const head=document.createElement('thead'),tr=document.createElement('tr');
  for(const name of ['Plan','Importe','Moneda','Método','Aprobación','Estado registrado'])tr.append(addText('th',name));
  head.append(tr);table.append(head);
  const body=document.createElement('tbody');
  for(const r of [...rows].sort((a,b)=>(date(b.decisionAt)?.getTime()||date(b.createdAt)?.getTime()||0)-(date(a.decisionAt)?.getTime()||date(a.createdAt)?.getTime()||0))){
   const row=document.createElement('tr');const amount=Number(r.amount);
   const values=[r.plan||'No indicado',Number.isFinite(amount)?amount.toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2}):'—',planCurrency(r),planMethod(r),shortDate(r.decisionAt||r.createdAt),'Aprobado'];
   for(const value of values)row.append(addText('td',String(value)));body.append(row);
  }
  table.append(body);scroll.append(table);section.append(scroll);
 }
 section.append(addText('p','Se muestran solicitudes aprobadas registradas en Firebase (hasta las últimas 200 consultadas). «Aprobado» no confirma que el ciclo siga vigente; la vigencia se comprobará con los datos del usuario. Los importes son de práctica y no representan fondos reales.','tiny'));
 container.append(section);
}
function renderStudentSummary(){
 const container=$('#studentSummary');container.replaceChildren();
 const s=sessions.find(x=>x.id===selectedId);if(!s){container.append(addText('p','Selecciona un usuario para consultar los datos disponibles.','muted'));return;}
 const wrapper=addText('div','','admin-profile-grid');
 const [l1,l2,l3]=countDescendants(s.id);
 const details=[['Nombre declarado',emptyDisplay(s.alias)],['Correo de contacto',emptyDisplay(s.email)],['Registro',shortDate(s.createdAt)],['Última actividad',shortDate(s.lastSeen)],['Vinculado a',linksMap[s.id]?studentName(linksMap[s.id]):'Sin vínculo'],['Referidos directos',String(l1)],['Segundo nivel',String(l2)],['Tercer nivel',String(l3)]];
 for(const [label,value] of details){const field=addText('div','','admin-profile-field');field.append(addText('small',label),addText('strong',value));wrapper.append(field);}
 container.append(wrapper);
 const titles=[['deposit_confirmed','Aportes de práctica registrados'],['plan_assign','Capital asignado (eventos)'],['withdraw_attempt','Retiros solicitados (eventos)'],['referral_credit','Bonos simulados registrados']];
 const metrics=addText('div','','admin-event-metrics');
 for(const [type,label] of titles){const matching=events.filter(e=>e.type===type);const amounts=matching.map(eventAmount).filter(v=>v!==null&&Number.isFinite(v));const val=amounts.length?money(amounts.reduce((a,b)=>a+b,0)):'—';
 const item=addText('div','','admin-metric');item.append(addText('small',label),addText('strong',val),addText('span',`${matching.length} evento(s) registrado(s)`,'tiny'));metrics.append(item);}
 container.append(metrics);
 renderStudentPlans(container,s.id);
 const approved=withdrawalRequests.filter(w=>w.studentUid===s.id&&w.status==='approved');
 const approvedTotal=approved.reduce((sum,w)=>sum+(Number(w.amount)||0),0);
 const withdrawInfo=addText('p',`Solicitudes de retiro aprobados en Firebase: ${approved.length} operación(es), ${money(approvedTotal)} en total. Este importe debe permanecer descontado tras recargar el panel del usuario.`, 'tiny');
 container.append(withdrawInfo);
 const estimate=earningSummaries[selectedId];
 if(estimate){const metrics2=addText('div','','admin-event-metrics');for(const [label,amount] of [['Rendimiento de práctica pendiente',estimate.unpaidPlanYield],['Bonos por referidos pendientes',estimate.referralAvailable],['Ganancia disponible · declarada',estimate.availableToRequest],['Días para el ciclo',estimate.daysRemaining]]){const el=addText('div','','admin-metric');el.append(addText('small',label),addText('strong',label==='Días para el ciclo'?String(amount):money(amount)));metrics2.append(el);}container.append(metrics2);container.append(addText('p','Resumen enviado desde el navegador del usuario; no es un saldo verificado en servidor ni prueba de pago. Actualizado: '+shortDate(estimate.updatedAt),'tiny'));}
 const note=addText('p','Los importes de eventos pueden ser parciales; el resumen de ganancias, si aparece, es informativo y fue calculado por el navegador del usuario, NO un saldo auditado ni comprobación de fondos. Todo es de práctica.','admin-summary-note');container.append(note);
 icRenderPremium();
}


// V5 · Bandeja de solicitudes de crédito exclusivamente de práctica, en tiempo real.
function renderAdminCreditRequests(){
 const list=$('#creditApprovalList');list.replaceChildren();
 const pending=creditRequests.filter(x=>x.status==='pending');
 $('#pendingApprovals').textContent=String(pending.length);
 $('#approvalsSummary').textContent=pending.length?`${pending.length} solicitud(es) antiguas sin resolver · Archivo de consulta (no se utilizan para activar planes)`:'Archivo de registros antiguos. No se generan solicitudes nuevas aquí.';
 const recent=[...creditRequests].sort((a,b)=>{
  if(a.status==='pending'&&b.status!=='pending')return -1;
  if(b.status==='pending'&&a.status!=='pending')return 1;
  return (b.createdAt?.seconds||0)-(a.createdAt?.seconds||0);
 }).slice(0,40);
 if(!recent.length){list.append(addText('p','Todavía no hay solicitudes de práctica.','muted'));return;}
 for(const r of recent){
  const row=addText('div','','admin-approval-row');
  const detail=document.createElement('div');detail.className='admin-approval-detail';
  const uid=r.studentUid||'';const name=studentName(uid)||r.studentAlias||'Usuario';
  detail.append(addText('strong',name),addText('p',`${money(r.amount)} de práctica · ${shortDate(r.createdAt)}`,'tiny'));
  const state=addText('span',r.status==='approved'?'Aprobada':r.status==='rejected'?'Rechazada':'Pendiente de revisión','tag '+(r.status==='pending'?'warn':r.status==='rejected'?'danger':''));
  row.append(detail,state);
  // Solo lectura: no pedir una segunda aprobación sobre créditos del flujo antiguo.
  // Las solicitudes de activación nuevas se administran exclusivamente en la bandeja de planes.
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
 if(!rows.length){list.append(addText('p','Todavía no hay activaciones de planes de práctica.','muted'));return;}
 for(const r of rows){
  const row=addText('div','','admin-approval-row'),detail=addText('div','','admin-approval-detail');
  const name=sessions.find(s=>s.id===r.studentUid)?.alias||r.studentAlias||'Usuario';
  detail.append(addText('strong',name),addText('p',`Plan: ${r.plan} · ${money(r.amount)} DEMO · ${shortDate(r.createdAt)}`,'tiny'));
  const state=addText('span',r.status==='approved'?'Plan activado':r.status==='rejected'?'Rechazada':'Pendiente','tag '+(r.status==='approved'?'ic-plan-activated':r.status==='pending'?'warn':r.status==='rejected'?'danger':''));
  row.append(detail,state);
  if(r.status==='pending')for(const [decision,label,klass] of [['approved','Aprobar','btn-primary'],['rejected','Rechazar','btn-soft']]){
   const btn=addText('button',label,'btn '+klass);btn.type='button';
   btn.addEventListener('click',async()=>{
    if(!window.confirm(`¿${decision==='approved'?'Activar':'Rechazar'} el plan ${r.plan} (${money(r.amount)} DEMO) para ${name}? No se mueve dinero real.`))return;
    row.querySelectorAll('button').forEach(x=>x.disabled=true);
    $('#planApprovalsMessage').textContent='Guardando decisión…';
    try{await reviewVirtualPlanRequest(firebase,r.id,decision);$('#planApprovalsMessage').textContent='Decisión guardada; el usuario verá la activación o el rechazo en su panel.';}
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
 $('#withdrawalApprovalsSummary').textContent=pend.length?`${pend.length} solicitud(es) de retiro pendiente(s) · En vivo`:'No hay solicitudes de retiro pendientes. Las solicitudes aparecerán aquí automáticamente.';
 const recent=[...withdrawalRequests].sort((a,b)=>{
  if(a.status==='pending'&&b.status!=='pending')return -1;
  if(b.status==='pending'&&a.status!=='pending')return 1;
  return (date(b.createdAt)?.getTime()||0)-(date(a.createdAt)?.getTime()||0);
 }).slice(0,40);
 if(!recent.length){list.append(addText('p','Todavía no hay solicitudes de retiro.','muted'));return;}
 for(const r of recent){
  const row=addText('div','','admin-approval-row');const detail=addText('div','','admin-approval-detail');
  const name=sessions.find(s=>s.id===r.studentUid)?.alias||r.studentAlias||'Usuario';
  const summary=earningSummaries[r.studentUid];
  const info=summary?` · Ganancias declaradas: ${money(summary.availableToRequest)} · ${summary.daysRemaining} días del ciclo restantes`:' · Saldo informativo del usuario todavía no sincronizado';
  detail.append(addText('strong',name),addText('p',`${money(r.amount)} de práctica · ${shortDate(r.createdAt)}${info}`,'tiny'));
  const state=addText('span',r.status==='approved'?'Aprobada':r.status==='rejected'?'Rechazada':'Pendiente de revisión','tag '+(r.status==='approved'?'ic-withdrawal-approved':r.status==='pending'?'warn':r.status==='rejected'?'danger':''));
  row.append(detail,state);
  if(r.status==='pending')for(const [decision,caption,variant] of [['approved','Aprobar','btn-primary'],['rejected','Rechazar','btn-soft']]){
   const b=document.createElement('button');b.type='button';b.className='btn '+variant;b.textContent=caption;
   b.addEventListener('click',async()=>{
    const action=decision==='approved'?'aprobar':'rechazar';
    if(!window.confirm(`¿Confirmas ${action} el retiro DE PRÁCTICA de ${money(r.amount)} para ${name}? No se transfiere dinero.`))return;
    row.querySelectorAll('button').forEach(button=>button.disabled=true);
    $('#withdrawalApprovalsMessage').textContent='Guardando la decisión…';
    try{await reviewVirtualWithdrawalRequest(firebase,r.id,decision);$('#withdrawalApprovalsMessage').textContent='Decisión registrada. El usuario verá el nuevo estado al conectarse.';}
    catch(e){$('#withdrawalApprovalsMessage').textContent='Error al guardar la decisión: '+e.message;row.querySelectorAll('button').forEach(button=>button.disabled=false);}
   });row.append(b);
  }
  list.append(row);
 }
}

const shortDate=x=>{const d=date(x);return d?d.toLocaleString('es-ES',{dateStyle:'short',timeStyle:'short'}):'—';};
function setError(s){$('#loginError').textContent=s;}
function teacherReady(f){
 firebase=f;$('#adminGate').classList.add('hidden');$('#adminContent').classList.remove('hidden');$('#logoutAdmin').classList.remove('hidden');$('#icSidebar').classList.remove('hidden');
 $('#adminIdentity').textContent=f.auth.currentUser.email;
 abrirDirectorio(f, window.INVEST_DEMO_CONFIG.supabaseUrl + '/functions/v1/aula-admin-alumnos');
 watch();
}
function watch(){
 const {db,Store}=firebase;
 offSessions();offScenario();offLinks();offCreditRequests();offWithdrawalRequests();offPlanRequests();offEarningSummaries();
    offCreditRequests=watchAdminVirtualCreditRequests(firebase,rows=>{creditRequests=rows;renderAdminCreditRequests();},e=>{$('#approvalsMessage').textContent='Error de permisos o conexión al leer solicitudes: '+e.message;});
    offPlanRequests=watchAdminVirtualPlanRequests(firebase,rows=>{planRequests=rows;renderAdminPlanRequests();if(selectedId)renderStudentSummary();},e=>{$('#planApprovalsMessage').textContent='No se pudieron leer activaciones: '+e.message;});
 offWithdrawalRequests=watchAdminVirtualWithdrawalRequests(firebase,rows=>{withdrawalRequests=rows;renderAdminWithdrawalRequests();if(selectedId)renderStudentSummary();},e=>{$('#withdrawalApprovalsMessage').textContent='Error de permisos o conexión al leer solicitudes de retiro: '+e.message;});
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
// V8.7 · Ajustar los días y ganancias de UNA cuenta de usuario en Firestore.
function refreshTeacherStudents(){
 const sel=$('#teacherStudent');if(!sel)return;
 const previous=sel.value||teacherSelectedUid;
 sel.replaceChildren(new Option('Selecciona un usuario de prueba',''));
 for(const s of sessions){sel.add(new Option(`${s.alias||'Usuario'} · ${s.email||s.id.slice(0,10)}`,s.id));}
 const next=sessions.some(s=>s.id===previous)?previous:'';
 sel.value=next;
 if(next!==teacherSelectedUid){teacherSelectedUid=next;loadTeacherStudent();}
}
function loadTeacherStudent(){
 offTeacherSettings();offTeacherSettings=()=>{};
 const uid=teacherSelectedUid;
 const form=$('#teacherStudentForm'),status=$('#teacherSettingsStatus');
 form.classList.toggle('hidden',!uid);
 if(!uid){status.textContent='Elige una cuenta seleccionada para cambiar sus días y ganancias de práctica.';return;}
 status.textContent='Cargando ajustes de '+studentName(uid)+'…';
 offTeacherSettings=watchAdminTeacherSettings(firebase,uid,data=>{
  if(teacherSelectedUid!==uid)return;
  teacherSettings={extraDays:Number(data.extraDays)||0,bonus:Number(data.bonus)||0,plan:String(data.plan||'')};
  $('#teacherPlan').value=[...$('#teacherPlan').options].some(x=>x.value===teacherSettings.plan)?teacherSettings.plan:'';
  $('#teacherExtraDays').value=String(teacherSettings.extraDays);
  $('#teacherBonus').value=String(teacherSettings.bonus);
  const approved=withdrawalRequests.filter(x=>x.studentUid===uid&&x.status==='approved');
  const paid=approved.reduce((sum,x)=>sum+(Number(x.amount)||0),0);
  status.textContent=`Usuario: ${studentName(uid)} · Plan asignado: ${teacherSettings.plan||'Sin asignación manual'} · ${teacherSettings.extraDays} día(s) adelantados · ${money(teacherSettings.bonus)} de ganancia extra · ${money(paid)} retirados anteriormente en ${approved.length} aprobación(es).`;
 },e=>{status.textContent='Error leyendo ajustes: '+e.message;});
}
$('#teacherStudent').addEventListener('change',e=>{teacherSelectedUid=e.target.value;loadTeacherStudent();});
$('#teacherStudentForm').addEventListener('submit',async e=>{
 e.preventDefault();const uid=teacherSelectedUid,button=$('#teacherSave');
 if(!uid)return;
 const d=Number($('#teacherExtraDays').value), b=Number($('#teacherBonus').value), chosen=$('#teacherPlan').value;
 if(!Number.isInteger(d)||d<0||d>365||!Number.isFinite(b)||b<0||b>100000||Math.abs(Math.round(b*100)-b*100)>1e-6){$('#teacherSettingsStatus').textContent='Introduce días enteros entre 0 y 365 y ganancias entre 0 y 100.000 (dos decimales).';return;}
 button.disabled=true;$('#teacherSettingsStatus').textContent='Guardando en Firebase para '+studentName(uid)+'…';
 try{await setAdminTeacherSettings(firebase,uid,d,b,chosen);$('#teacherSettingsStatus').textContent='Ajustes guardados. Entra con la cuenta del usuario para verificarlo.';}
 catch(err){$('#teacherSettingsStatus').textContent='No se pudo guardar: '+err.message;}
 finally{button.disabled=false;}
});
$('#teacherReset').addEventListener('click',async()=>{
 const uid=teacherSelectedUid;if(!uid)return;
 if(!confirm('¿Restablecer días y ganancia extra de '+studentName(uid)+'? Los retiros anteriores seguirán en su historial.'))return;
 $('#teacherPlan').value='';$('#teacherExtraDays').value='0';$('#teacherBonus').value='0';
 try{await setAdminTeacherSettings(firebase,uid,0,0,'');$('#teacherSettingsStatus').textContent='Ajustes de cuenta restablecidos.';}
 catch(e){$('#teacherSettingsStatus').textContent='No se pudo restablecer: '+e.message;}
});
function refreshStudents(){
 refreshTeacherStudents();
 $('#sessionsCount').textContent=String(sessions.length);
 $('#activeCount').textContent=String(sessions.filter(x=>date(x.lastSeen)&&Date.now()-date(x.lastSeen).getTime()<300000).length);
 // El contador corresponde solo a los eventos cargados del usuario seleccionado.
 $('#withdrawCount').textContent=String(events.filter(x=>x.type==='withdraw_attempt').length);
 const list=$('#studentList');list.replaceChildren();
 const visible=getVisibleStudents();$('#studentResults').textContent=`${visible.length} de ${sessions.length} sesiones`;
 $('#exportStudents').disabled=!visible.length;
 if(!visible.length){list.append(addText('p',sessions.length?'No hay usuarios que coincidan con el filtro.':'Todavía no hay sesiones registradas.','muted'));return;}
 visible.forEach(s=>{
   const b=document.createElement('button');b.type='button';b.className='admin-item'+(s.id===selectedId?' active':'');
   b.setAttribute('aria-label','Ver ficha de '+(s.alias||'usuario'));
   const avatar=addText('span','','ic-list-avatar');avatar.innerHTML='<svg class="ic-icon" aria-hidden="true"><use href="#ic-person"></use></svg>';
   const info=addText('span','','ic-list-info');
   info.append(addText('b',s.alias||'Usuario sin nombre'),addText('small','ID: '+String(s.id).slice(0,11)));
   const isRecent=!!(date(s.lastSeen)&&Date.now()-date(s.lastSeen).getTime()<300000);
   const status=addText('span',isRecent?'Reciente':'Sin actividad','ic-list-status'+(isRecent?' ic-online':''));
   b.append(avatar,info,status);b.addEventListener('click',()=>select(s.id));list.append(b);
 });
 $('#icRosterCount').textContent=String(sessions.length);
 icRenderPremium();
 if(selectedId&&!sessions.find(s=>s.id===selectedId)){offStudentProfile();offStudentProfile=()=>{};studentProfileData=null;icProfileLoadState='idle';selectedId=null;events=[];offEvents();$('#selectedStudent').textContent='Selecciona un usuario';$('#studentProfile').textContent='';$('#withdrawCount').textContent='0';renderStudentSummary();}
}

function studentName(uid){return sessions.find(s=>s.id===uid)?.alias||'Usuario '+String(uid).slice(0,6);}
function showSelectedProfile(){
 const s=sessions.find(x=>x.id===selectedId);if(!s)return;
 const invitedBy=linksMap[selectedId];
 $('#studentProfile').textContent=[s.group?'Grupo anterior: '+s.group:'',s.email?'Correo o teléfono (declarado): '+s.email:'',invitedBy?'Vinculado a: '+studentName(invitedBy):''].filter(Boolean).join(' · ')||'Sin datos adicionales';
}
function renderLinks(){
 const ids=Object.keys(linksMap);
 $('#linksCount').textContent=ids.length+' vínculos';
 const tbody=$('#linksRows');tbody.replaceChildren();
 if(!ids.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=4;td.textContent='Todavía no hay usuarios vinculados.';tr.append(td);tbody.append(tr);return;}
 for(const id of ids.slice(0,150)){
  const chain=[];let parent=linksMap[id];const seen=new Set([id]);
  while(parent && !seen.has(parent) && chain.length<3){chain.push(parent);seen.add(parent);parent=linksMap[parent];}
  const tr=document.createElement('tr');
  for(const v of [id,...[0,1,2].map(i=>chain[i])]){const td=document.createElement('td');td.textContent=v?studentName(v):'—';tr.append(td);}
  tbody.append(tr);
 }
}

function select(uid){
 if($('#teacherStudent')){$('#teacherStudent').value=uid;teacherSelectedUid=uid;loadTeacherStudent();}
 offStudentProfile();offStudentProfile=()=>{};studentProfileData=null;icProfileLoadState='loading';selectedId=uid;events=[];offEvents();icRenderActivityPreview();icWatchStudentProfile(uid);$('#withdrawCount').textContent='0';$('#eventTypeFilter').value='all';
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
 icRenderActivityPreview();
 if(!visible.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=3;td.textContent=events.length?'No hay acciones de este tipo.':'Este usuario aún no tiene acciones registradas.';tr.append(td);table.append(tr);return;}
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
 downloadCsv('invest-capital-alumnos-simulacion.csv',['Usuario','Correo declarado','Grupo','Fecha de registro','Ultima actividad','Vinculado a','Referidos nivel 1','Nivel 2','Nivel 3'],visible.map(s=>{
 const counts=countDescendants(s.id);return[s.alias||'',s.email||'',s.group||'',shortDate(s.createdAt),shortDate(s.lastSeen),linksMap[s.id]?studentName(linksMap[s.id]):'',...counts];
 }));
});
$('#exportCsv').addEventListener('click',()=>{
 const s=sessions.find(x=>x.id===selectedId);
 downloadCsv('invest-capital-actividad-'+(s?.alias||'usuario').replace(/[^a-z0-9-_]/gi,'_')+'.csv',
 ['Fecha','Seccion','Accion','Tipo','Importe de práctica USDT (si consta)'],filteredEvents().map(e=>[shortDate(e.createdAt),e.view,e.label,e.type,eventAmount(e)??'']));
});
$('#loginAdmin').addEventListener('click',async()=>{
 setError('');const b=$('#loginAdmin');b.disabled=true;b.textContent='Verificando cuenta…';
 try{teacherReady(await adminLogin());}catch(e){setError('Acceso no autorizado o error de inicio de sesión: '+e.message);}
 finally{b.disabled=false;b.textContent='Acceder con Google';}
});
$('#logoutAdmin').addEventListener('click',async()=>{offTeacherSettings();offStudentProfile();offSessions();offEvents();offScenario();offLinks();offCreditRequests();offWithdrawalRequests();offPlanRequests();offEarningSummaries();if(firebase)await firebase.Auth.signOut(firebase.auth);location.reload();});
(async()=>{
 if(!firebaseEnabled){setError('El seguimiento remoto todavía no está activado. Configura Firebase siguiendo INSTRUCCIONES.md.');return;}
 try{const f=await adminCurrent();if(f)teacherReady(f);}catch(e){setError('No se pudo comprobar la sesión: '+e.message);}
})();
window.addEventListener('pagehide',()=>{offTeacherSettings();offStudentProfile();offSessions();offEvents();offScenario();offLinks();offCreditRequests();offWithdrawalRequests();offPlanRequests();offEarningSummaries();});


// === Invest Capital · Teacher premium panel — only reads studentProfiles/{uid}. ===
// Firestore access uses the already signed-in teacher; no new auth or write permissions.
const icText=(selector,value)=>{const el=$(selector);if(el)el.textContent=value==null?'—':String(value);};
const icIsRecent=s=>!!(date(s?.lastSeen)&&Date.now()-date(s.lastSeen).getTime()<300000);
const icMoney=n=>n!==null&&n!==undefined&&n!==''&&Number.isFinite(Number(n))?Number(n).toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})+' USDT-DEMO':'—';
function icWatchStudentProfile(uid){
 icText('#icProfileStatus','Consultando el perfil del usuario en Firebase…');
 const f=firebase;if(!f||!uid)return;
 offStudentProfile=f.Store.onSnapshot(f.Store.doc(f.db,'studentProfiles',uid),snapshot=>{
  if(selectedId!==uid)return;
  studentProfileData=snapshot.exists()?snapshot.data():null;icProfileLoadState='loaded';
  icRenderPremium();
 },err=>{
  if(selectedId!==uid)return;
  studentProfileData=null;icProfileLoadState='error';icRenderPremium();
  icText('#icProfileStatus','Error al consultar el perfil: '+err.message);
 });
}
function icRenderPremium(){
 const s=sessions.find(x=>x.id===selectedId);
 if(!s){
  for(const key of ['icKpiPlans','icKpiCapital','icKpiEarnings','icKpiAvailable','icProfileName','icProfileLast','icProfileEmail','icProfilePhone','icProfileMethod','icProfileReference','icProfileDate'])icText('#'+key,'—');
  icText('#icSelectedId','Sin seleccionar');icText('#icSelectedStatus','—');
  icText('#icProfileStatus','Selecciona un usuario para consultar su perfil registrado.');
  $('#icCopyReference').disabled=true;
  $('#icSelectedStatus').classList.remove('ic-online');
  return;
 }
 $('#icSelectedId').textContent='ID: '+String(s.id).slice(0,11);
 $('#icSelectedId').title=s.id;
 const active=icIsRecent(s);
 $('#icSelectedStatus').textContent=active?'Reciente':'Sin actividad';
 $('#icSelectedStatus').classList.toggle('ic-online',active);
 const approved=planRequests.filter(r=>r.studentUid===selectedId&&r.status==='approved');
 icText('#icKpiPlans',String(approved.length));
 const currs=new Set(approved.map(planCurrency));
 const amounts=approved.map(r=>Number(r.amount));
 const valid=amounts.every(x=>Number.isFinite(x)&&x>=0);
 icText('#icKpiCapital',!approved.length?'Sin registros':!valid||currs.size>1?'Varias monedas':(amounts.reduce((a,b)=>a+b,0).toLocaleString('es-ES',{maximumFractionDigits:2})+' '+(currs.values().next().value||'DEMO')));
 const report=earningSummaries[selectedId];
 icText('#icKpiEarnings',report&&report.grossPlanYield!=null?icMoney(report.grossPlanYield):'Sin datos');
 icText('#icKpiAvailable',report&&report.availableToRequest!=null?icMoney(report.availableToRequest):'Sin datos');
 const p=studentProfileData;
 icText('#icProfileName',p?.firstName||'No registrado');
 icText('#icProfileLast',p?.lastName||'No registrado');
 icText('#icProfileEmail',s.email||'No disponible');
 icText('#icProfilePhone',p?.phone||'No registrado');
 icText('#icProfileMethod',({'sber':'Sberbank','bep20':'USDT BEP20','trc20':'USDT TRC20','':'No elegido'})[p?.withdrawalMethod??'']||'No registrado');
 // Preserve EXACT reference text from Firestore, without formatting or truncation.
 const reference=p&&typeof p.withdrawalReference==='string'?p.withdrawalReference:'';
 icText('#icProfileReference',reference||'No registrada');
 $('#icCopyReference').disabled=!reference;
 icText('#icProfileDate',p?.updatedAt?shortDate(p.updatedAt):'Sin registro');
 icText('#icProfileStatus',icProfileLoadState==='loading'?'Consultando el perfil del usuario en Firebase…':icProfileLoadState==='error'?'No se pudo consultar el perfil.':p?'Datos sincronizados desde Firebase · Solo lectura':'Todavía no ha guardado un perfil de práctica.');
 icRenderSelectedPlans();icRenderSelectedReferrals();icRenderSelectedWithdrawals();
}
function icRenderSelectedPlans(){
 const box=$('#icSelectedPlans');if(!box)return;box.replaceChildren();
 if(!selectedId){box.append(addText('p','Selecciona un usuario.','muted'));return;}
 renderStudentPlans(box,selectedId);
}
function icRenderSelectedReferrals(){
 const box=$('#icSelectedReferrals');if(!box)return;box.replaceChildren();
 if(!selectedId){box.append(addText('p','Selecciona un usuario.','muted'));return;}
 const [a,b,c]=countDescendants(selectedId);
 const panel=addText('div','','ic-single-module');
 const counters=addText('div','','admin-event-metrics');
 for(const [label,val] of [['Nivel 1',a],['Nivel 2',b],['Nivel 3',c]]){
  const item=addText('div','','admin-metric');item.append(addText('small',label),addText('strong',String(val)));counters.append(item);
 }
 panel.append(counters,addText('p',linksMap[selectedId]?'Usuario vinculado a: '+studentName(linksMap[selectedId]):'No hay vínculo anterior registrado para esta cuenta.','tiny'));
 box.append(panel);
}
function icRenderSelectedWithdrawals(){
 const box=$('#icSelectedWithdrawals');if(!box)return;box.replaceChildren();
 if(!selectedId){box.append(addText('p','Selecciona un usuario.','muted'));return;}
 const rows=withdrawalRequests.filter(w=>w.studentUid===selectedId).slice().sort((a,b)=>(date(b.createdAt)?.getTime()||0)-(date(a.createdAt)?.getTime()||0));
 const module=addText('div','','ic-single-module');
 module.append(addText('p',`${rows.length} solicitud(es) de retiro registradas en Firebase.`,'tiny'));
 if(rows.length){
  const wrap=addText('div','','ic-table-viewport'),table=addText('table','','ic-premium-table');
  const head=document.createElement('thead'),tr=document.createElement('tr');for(const t of ['Fecha','Importe','Estado'])tr.append(addText('th',t));head.append(tr);table.append(head);
  const body=document.createElement('tbody');for(const w of rows){const r=document.createElement('tr');for(const value of [shortDate(w.createdAt),icMoney(w.amount),w.status==='approved'?'Aprobada':w.status==='rejected'?'Rechazada':'Pendiente'])r.append(addText('td',value));body.append(r);}table.append(body);wrap.append(table);module.append(wrap);
 }else module.append(addText('p','Sin solicitudes de retiro registrados.','muted'));
 box.append(module);
}
function icRenderActivityPreview(){
 const body=$('#icActivityPreview');if(!body)return;body.replaceChildren();
 const rows=events.slice(0,4);if(!selectedId||!rows.length){const tr=document.createElement('tr'),td=addText('td',selectedId?'Todavía no hay acciones registradas.':'Selecciona un usuario para consultar su actividad.');td.colSpan=3;tr.append(td);body.append(tr);return;}
 for(const item of rows){const tr=document.createElement('tr');for(const value of [shortDate(item.createdAt),String(item.view||'—'),String(item.label||'—')])tr.append(addText('td',value));body.append(tr);}
}
function icSwitchTab(key){
 $$('.ic-tab').forEach(b=>{const selected=b.dataset.icTab===key;b.classList.toggle('active',selected);b.setAttribute('aria-selected',String(selected));});
 $$('[data-ic-panel]').forEach(el=>el.classList.toggle('hidden',el.dataset.icPanel!==key));
}
$$('[data-ic-tab]').forEach(btn=>btn.addEventListener('click',()=>icSwitchTab(btn.dataset.icTab)));
$$('[data-open-tab]').forEach(btn=>btn.addEventListener('click',()=>icSwitchTab(btn.dataset.openTab)));
$$('[data-ic-nav]').forEach(btn=>btn.addEventListener('click',()=>{
 $$('[data-ic-nav]').forEach(el=>el.classList.toggle('active',el===btn));
 if(btn.dataset.icNav==='icRoster'){icSwitchTab('resumen');}
 document.getElementById(btn.dataset.icNav)?.scrollIntoView({behavior:'smooth',block:'start'});
}));
$('#icCopyReference').addEventListener('click',async()=>{
 const reference=studentProfileData?.withdrawalReference;
 if(typeof reference!=='string'||!reference)return;
 try{await navigator.clipboard.writeText(reference);icText('#icCopiedNote','Referencia copiada.');}
 catch(e){icText('#icCopiedNote','No se pudo copiar automáticamente; selecciona el texto de la referencia.');}
});
