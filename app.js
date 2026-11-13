import {studentStart,logStudent,watchStage,firebaseEnabled,getFirebase,classroomCode,linkClassroomMember,getClassroomLink,recordClassroomContribution,watchClassroomRewards,watchVirtualCreditRequests,requestVirtualWithdrawal,watchVirtualWithdrawalRequests,requestVirtualPlanActivation,watchVirtualPlanRequests,saveVirtualEarningsSummary,watchStudentTeacherSettings} from './backend.js?v=93';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const alias=(localStorage.getItem('ic_v3_alias')||'').trim();
let profile={name:alias,email:'',group:''};
try{let p=JSON.parse(localStorage.getItem('ic_v3_profile')||'null');if(p?.name===alias)profile={name:alias,email:String(p.email||''),group:String(p.group||''),referralCode:String(p.referralCode||'')};}catch{}
if(localStorage.getItem('ic_v3_consent')!=='yes'||!alias)location.replace('index.html');
const titles={resumen:['Resumen de cuenta','Estado general de tu cartera'],planes:['Planes de inversión','Condiciones y oportunidades de gestión'],calculadora:['Calculadora de rendimientos','Proyección de capital según plan y días'],cartera:['Mi cartera','Posiciones y distribución de activos'],movimientos:['Historial de movimientos','Operaciones registradas en tu cuenta'],referidos:['Programa de asociados','Información de tu red de asociados'],documentos:['Centro documental','Información corporativa y condiciones'],soporte:['Centro de atención','Gestión de solicitudes y consultas']};
const plans={Essential:{min:100,rate:.02,weeks:8},Advanced:{min:300,rate:.035,weeks:12},Prime:{min:500,rate:.05,weeks:16},"Magnate Supremo":{min:1000,rate:.07,weeks:20},Platinum:{min:1500,rate:.085,weeks:24},Signature:{min:3000,rate:.10,weeks:28}};
const storedAuthUid=localStorage.getItem('ic_v3_auth_uid')||'';
// Guardar la elección por cuenta, no solo por pestaña, evita perder el plan
// cuando el alumno regresa al dashboard después de que el profesor rechace.
const SELECTED_PLAN_KEY='ic_selected_plan_for_'+(storedAuthUid||encodeURIComponent(alias.toLowerCase()));
const planQuery=new URLSearchParams(location.search).get('plan');
function currentChosenPlan(){
 const fromTab=sessionStorage.getItem('ic_selected_plan');
 const fromAccount=localStorage.getItem(SELECTED_PLAN_KEY);
 return plans[fromTab]?fromTab:(plans[fromAccount]?fromAccount:'');
}
function rememberChosenPlan(plan){
 if(!plans[plan])return;
 sessionStorage.setItem('ic_selected_plan',plan);
 localStorage.setItem(SELECTED_PLAN_KEY,plan);
}
const publicPlan=plans[planQuery]?planQuery:currentChosenPlan();
if(publicPlan)rememberChosenPlan(publicPlan);
function showChosenPlanBanner(){
 const box=$('#selectedPlanBanner');if(!box)return;
 const name=currentChosenPlan();
 box.classList.toggle('hidden',!name);if(!name)return;
 const p=plans[name],btn=$('#selectedPlanAction'),message=$('#selectedPlanMessage');
 $('#selectedPlanTitle').textContent=`${name} · ${money(p.min)} en USDT de práctica`;
 const active=activePositions().some(x=>x.plan===name&&remainingPrincipal(x)>0);
 const pending=planActivationRequests.find(x=>x.plan===name&&x.status==='pending')||(planSubmitId?{plan:name,status:'pending'}:null);
 const rejected=planActivationRequests.filter(x=>x.plan===name&&x.status==='rejected').length>0;
 btn.classList.toggle('ic-plan-active-button',active);
 if(active){message.textContent='Este plan está activado en tu cartera de práctica. El importe está asignado únicamente a este plan.';btn.textContent='Plan activado';btn.disabled=true;btn.onclick=null;return;}
 if(pending){message.textContent='Tu simulación de envío está pendiente de revisión. No se ha acreditado saldo libre ni activado otro plan.';btn.textContent='Pendiente de revisión';btn.disabled=true;btn.onclick=null;return;}
 message.textContent=`Para activar este plan debes invertir ${money(p.min)} de práctica mediante la cartera de práctica USDT. No se envía dinero real.`+(rejected?' La última solicitud fue rechazada; puedes repetir el ejercicio.':'');
 btn.textContent=rejected?'Volver a invertir':'Invertir para activar';btn.disabled=planSubmitBusy;btn.onclick=()=>openPlanWallet(name);
}

const STORE=storedAuthUid?'ic_v34_uid_'+storedAuthUid:'ic_v34_'+encodeURIComponent((alias+'|'+profile.group).toLowerCase());
const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=n=>Math.round((Number(n)||0)*100)/100;
const MS_DAY=86400000;
// Días de calendario, no bloques completos de 24 horas: hoy 30, mañana 29.
function calendarDay(t){const d=new Date(t);return Math.floor(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())/MS_DAY);}
function calendarElapsed(t){return Number.isFinite(t)&&t>0?Math.max(0,calendarDay(Date.now())-calendarDay(t)):0;}
function timestampMs(x){return x?.toMillis?.()??(Number(x?.seconds)>0?Number(x.seconds)*1000:0);}

// Por día natural transcurrido: tasa semanal proporcional, interés simple,
// limitado al plazo del plan. No hay precios, tokens ni rendimientos reales.
function elapsedDays(when){return calendarElapsed(Number(when))+testSettings.extraDays;}
function legacyStart(pos){
 if(Number.isFinite(pos.openedAt)&&pos.openedAt>0)return pos.openedAt;
 const m=String(pos.date||'').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
 if(m){const date=new Date(+m[3],+m[2]-1,+m[1]);if(Number.isFinite(date.getTime()))return date.getTime();}
 return Date.now();
}
function projected(amount,plan,days,rateAtOpen=null){
 const conf=plans[plan];if(!conf)return {profit:0,effectiveDays:0,total:num(amount)};
 const effectiveDays=Math.min(Math.max(0,Math.floor(days)),conf.weeks*7);
 const r=Number.isFinite(rateAtOpen)&&rateAtOpen>=0&&rateAtOpen<=1?rateAtOpen:conf.rate;
 const profit=num(amount*r*effectiveDays/7);
 return {profit,effectiveDays,total:num(amount+profit)};
}
// V8.8 · El saldo no se deduce de un descuento local que puede perderse.
// La fuente de los retiros aprobados son los documentos de Firebase de esta cuenta.
function positionProfit(pos){
 const gross=num(projected(pos.amount,pos.plan,elapsedDays(legacyStart(pos)),pos.rate).profit);
 return Math.max(0,num(gross-planWithdrawalAllocation(pos)));
}
function remainingPrincipal(p){return Math.max(0,num(p.amount-(Number(p.principalPaid)||0)));}
function planMatured(p){return elapsedDays(legacyStart(p))>=plans[p.plan].weeks*7;}

// Los ajustes son visibles únicamente para la cuenta de ensayo elegida por el docente.
let testSettings={extraDays:0,bonus:0,plan:'',planStartedAt:0};
let teacherPosition=null;
// Una asignación docente es una única posición de práctica controlada por Firebase.
// No se escribe al cash local ni se repite al recargar. Las posiciones antiguas
// siguen conservadas en el navegador, pero no se mezclan en esta prueba.
// V9.2: una posición activada y aprobada después del escenario docente no
// debe desaparecer cuando llega el snapshot de Firebase al recargar.
// Una asignación docente MÁS RECIENTE sí puede sustituir la vista anterior;
// nunca se suman ambas posiciones como si fueran depósitos distintos.
function useTeacherPosition(){
 if(!teacherPosition)return false;
 const latestApproval=Math.max(0,...account.positions
  .filter(p=>Boolean(p.activationRequestId))
  .map(p=>Number(p.openedAt)||0));
 const teacherStarted=Number(testSettings.planStartedAt)||0;
 return !latestApproval || teacherStarted>latestApproval;
}
function activePositions(){return useTeacherPosition()?[teacherPosition]:account.positions;}
function syncTeacherPosition(){
 const p=plans[testSettings.plan],started=Number(testSettings.planStartedAt);
 teacherPosition=p&&Number.isSafeInteger(started)&&started>0?{
  plan:testSettings.plan,amount:p.min,rate:p.rate,openedAt:started,
  date:new Date(started).toLocaleDateString('es-ES'),paidProfit:0,principalPaid:0,teacherPlan:true
 }:null;
}
const MIN_WITHDRAW_DEMO=50;
let unsubscribeTeacherSettings=()=>{};
let account={cash:0,positions:[],ledger:[],seq:0,withdrawalAnchor:0,lastWithdrawalCycle:-1,referrals:[],referralCreditedIds:{},approvedRequestIds:{},activatedPlanRequestIds:{},contributionQueue:[],reviewedWithdrawalIds:{},pendingWithdrawalRequestId:"",referralPaid:0,teacherBonusPaid:0,approvedWithdrawalReceipts:{},withdrawalLocalFloor:0};
try{
  const raw=JSON.parse(localStorage.getItem(STORE)||'null');
  if(raw&&Number.isFinite(raw.cash)&&Array.isArray(raw.positions)&&Array.isArray(raw.ledger)){
    account={cash:Math.max(0,num(raw.cash)),positions:raw.positions.filter(p=>plans[p.plan]&&Number.isFinite(p.amount)&&p.amount>0).slice(0,60).map(p=>({...p,paidProfit:Math.max(0,num(p.paidProfit||0)),principalPaid:Math.min(p.amount,Math.max(0,num(p.principalPaid||0)))})),ledger:raw.ledger.filter(r=>typeof r.name==='string'&&Number.isFinite(r.amount)).slice(0,100),seq:Number(raw.seq)||0,withdrawalAnchor:Number(raw.withdrawalAnchor)||0,lastWithdrawalCycle:Number.isInteger(raw.lastWithdrawalCycle)?raw.lastWithdrawalCycle:-1,referrals:Array.isArray(raw.referrals)?raw.referrals.filter(r=>[1,2,3].includes(r.level)&&Number.isFinite(r.amount)&&Number.isFinite(r.commission)).slice(0,100):[],referralCreditedIds:raw.referralCreditedIds&&typeof raw.referralCreditedIds==='object'&&!Array.isArray(raw.referralCreditedIds)?raw.referralCreditedIds:{},approvedRequestIds:raw.approvedRequestIds&&typeof raw.approvedRequestIds==='object'&&!Array.isArray(raw.approvedRequestIds)?raw.approvedRequestIds:{},activatedPlanRequestIds:raw.activatedPlanRequestIds&&typeof raw.activatedPlanRequestIds==='object'&&!Array.isArray(raw.activatedPlanRequestIds)?raw.activatedPlanRequestIds:{},reviewedWithdrawalIds:raw.reviewedWithdrawalIds&&typeof raw.reviewedWithdrawalIds==='object'&&!Array.isArray(raw.reviewedWithdrawalIds)?raw.reviewedWithdrawalIds:{},pendingWithdrawalRequestId:typeof raw.pendingWithdrawalRequestId==='string'?raw.pendingWithdrawalRequestId:"",referralPaid:Math.max(0,num(raw.referralPaid||0)),teacherBonusPaid:Math.max(0,num(raw.teacherBonusPaid||0)),contributionQueue:Array.isArray(raw.contributionQueue)?raw.contributionQueue.filter(p=>Number.isFinite(p.amount)&&p.amount>=1&&typeof p.reference==='string').slice(0,100):[],approvedWithdrawalReceipts:raw.approvedWithdrawalReceipts&&typeof raw.approvedWithdrawalReceipts==='object'&&!Array.isArray(raw.approvedWithdrawalReceipts)?raw.approvedWithdrawalReceipts:{},withdrawalLocalFloor:Math.max(0,num(raw.withdrawalLocalFloor||0))};
  }
}catch{}
// Migración conservadora: la V8.9 guardó recibos de retiros aprobados
// como movimientos negativos en este navegador. Protegerlos ante recargas
// si un snapshot temporal de Firestore no contiene los documentos anteriores.
const priorApprovedIds=Object.values(account.reviewedWithdrawalIds||{}).filter(v=>v==='approved').length;
if(priorApprovedIds){
 const historicalPaid=num((account.ledger||[]).filter(x=>x.kind==='withdraw'&&x.status==='Aprobado'&&Number(x.amount)<0)
  .reduce((sum,x)=>sum-Math.min(0,Number(x.amount)||0),0));
 account.withdrawalLocalFloor=Math.max(0,num(account.withdrawalLocalFloor||0),historicalPaid);
}
let view='resumen',stage=0,session={mode:'local'},sessionReady=false,sending=false,unsubscribe=()=>{},unsubscribeRewards=()=>{},unsubscribeCredits=()=>{},unsubscribeWithdrawals=()=>{},unsubscribePlanRequests=()=>{},onConfirm=null;
let chartProjectionDays=30; // 30D o 90D de proyección, diferenciada de la evolución ya calculada.
const pendingContributions=account.contributionQueue;
const referralRates={1:.15,2:.05,3:.03};
const pending=[], overlay=$('#actionModal'), modalTitle=$('#modalTitle'), modalContent=$('#modalContent'),confirmBtn=$('#confirmModal');
let connectionFailure=null;
function explainFirebaseIssue(error){
 const code=String(error?.code||'').toLowerCase();
 const msg=String(error?.message||'');
 if(!firebaseEnabled)return 'Firebase no está configurado en esta versión.';
 if(code.includes('permission-denied'))return 'Firebase rechazó los permisos de la solicitud. Comprueba que las reglas V8.3 estén publicadas y que uses tu cuenta de alumno.';
 if(code.includes('network')||code.includes('unavailable'))return 'No se pudo conectar a Firebase. Comprueba Internet y vuelve a intentar.';
 if(/sesión|cuenta|profesor|alumno|login|contraseña/i.test(msg))return msg;
 return 'No se pudo completar la conexión con Firebase: '+(msg||code||'Error desconocido');
}
function showFirebaseIssue(error){
 const box=$('#modalError');if(!box)return;
 const msg=explainFirebaseIssue(error);
 box.hidden=false;box.replaceChildren(document.createTextNode(msg));
 // No cerramos sesión ni eliminamos datos del alumno automáticamente.
 const link=document.createElement('a');link.href='index.html?login=1';
 link.textContent=' Volver a iniciar sesión';link.style.display='block';link.style.marginTop='8px';
 box.append(link);
}
function save(){localStorage.setItem(STORE,JSON.stringify(account));}
function record(type,label,which=view){if(!firebaseEnabled)return;pending.push({type,label,view:which});void flush();}
async function flush(){if(!sessionReady||sending||session.mode!=='cloud')return;sending=true;try{while(pending.length){const a=pending[0];await logStudent(session,a.type,a.label,a.view);pending.shift();}$('#syncStatus').textContent='Actividad conectada';}catch(e){console.warn('Acciones pendientes de conexión',e);$('#syncStatus').textContent='Sincronización pendiente';}finally{sending=false;}}
function setView(v){if(!titles[v])return;closeMobileNav();view=v;$$('.workspace-section').forEach(x=>x.classList.toggle('active',x.dataset.section===v));$$('.side-link').forEach(x=>{x.classList.toggle('active',x.dataset.view===v);x.setAttribute('aria-current',x.dataset.view===v?'page':'false');});$('#viewTitle').textContent=titles[v][0];$('#viewSubtitle').textContent=titles[v][1];record('section','Abrió '+titles[v][0],v);window.scrollTo({top:0,behavior:'smooth'});}
function closeMobileNav(){
 document.body.classList.remove('ic-mobile-menu-open');
 const toggle=document.getElementById('icMobileNavToggle');
 if(toggle){toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-label','Abrir menú de navegación');toggle.textContent='☰ Menú';}
}
function initMobileNav(){
 const toggle=document.getElementById('icMobileNavToggle');
 const scrim=document.getElementById('icMobileNavScrim');
 if(!toggle||!scrim)return;
 closeMobileNav();
 toggle.addEventListener('click',()=>{
  const opened=!document.body.classList.contains('ic-mobile-menu-open');
  document.body.classList.toggle('ic-mobile-menu-open',opened);
  toggle.setAttribute('aria-expanded',String(opened));
  toggle.setAttribute('aria-label',opened?'Cerrar menú de navegación':'Abrir menú de navegación');
  toggle.textContent=opened?'✕ Cerrar menú':'☰ Menú';
 });
 scrim.addEventListener('click',closeMobileNav);
 document.addEventListener('keydown',event=>{if(event.key==='Escape')closeMobileNav();});
 window.matchMedia('(min-width:751px)').addEventListener('change',closeMobileNav);
}
initMobileNav();
function modal(title,html,callback=null,button='Confirmar'){modalTitle.textContent=title;modalContent.innerHTML=html;onConfirm=callback;confirmBtn.classList.toggle('hidden',!callback);confirmBtn.textContent=button;confirmBtn.disabled=false;overlay.classList.remove('hidden');}
function close(){overlay.classList.add('hidden');onConfirm=null;}
function err(text){const e=$('#modalError');if(e){e.textContent=text;e.hidden=false;}}
function tx(name,amount,status,kind){const seq=++account.seq;account.ledger.unshift({name,amount:num(amount),status,kind,ref:'IC-'+String(Date.now()).slice(-6)+String(seq).padStart(2,'0'),date:new Date().toLocaleDateString('es-ES')});account.ledger=account.ledger.slice(0,100);save();render();}
function principal(){return num(activePositions().reduce((s,p)=>s+remainingPrincipal(p),0));}
// V8.8 · Libro de retiros de práctica aprobado, reconstruible tras cada recarga.
// Un retiro aprobado se descuenta SIEMPRE en el cálculo, nunca sólo de localStorage.
// Si falta conectar con Firebase no se habilitan retiros nuevos ni se muestran
// ganancias disponibles hasta conocer el historial completo.
let withdrawalHistoryReady=false,teacherSettingsReady=false,withdrawalAuditConflict=false;
let syncFailureMessage='';
let syncWatchdog=null;
function reportSyncFailure(source,error){
 const reason=String(error?.message||error||'Error desconocido');
 syncFailureMessage=source+': '+reason;
 console.error('Invest Capital / Firebase:',syncFailureMessage,error);
 const status=document.querySelector('#syncStatus');
 if(status)status.textContent='Error de sincronización: '+syncFailureMessage;
 render();
}
function syncDisplay(waiting){return waiting && syncFailureMessage?'Error de conexión':waiting;}

function earningsSynced(){return withdrawalHistoryReady&&teacherSettingsReady&&!withdrawalAuditConflict;}
// Fuente principal: los documentos de retiros aprobados en Firestore.
// Copia de seguridad: recibos confirmados y movimientos históricos de ESTE
// usuario en su navegador. Nunca suma dos veces el mismo identificador.
function withdrawalReceiptMap(){
 const found=new Map();
 for(const [id,receipt] of Object.entries(account.approvedWithdrawalReceipts||{})){
  if(!/^[A-Za-z0-9_-]{10,128}$/.test(id))continue;
  const amount=Number(receipt?.amount);
  if(Number.isFinite(amount)&&amount>=MIN_WITHDRAW_DEMO&&amount<=100000)
   found.set(id,{amount,when:Number(receipt?.when)||0,origin:'saved'});
 }
 for(const r of withdrawalRequests){
  if(!r||r.status!=='approved'||!r.id)continue;
  const amount=Number(r.amount);
  if(!Number.isFinite(amount)||amount<MIN_WITHDRAW_DEMO||amount>100000)continue;
  found.set(r.id,{amount,when:timestampMs(r.decisionAt)||timestampMs(r.createdAt)||0,origin:'firebase'});
 }
 return found;
}
function approvedWithdrawalTotal(upToDay=null){
 let total=0;
 for(const r of withdrawalReceiptMap().values()){
  if(upToDay!==null&&(!r.when||calendarDay(r.when)>upToDay))continue;
  total+=r.amount;
 }
 // V8.9 guardaba algunos retiros sólo como movimientos, sin ID. El piso
 // local se usa exclusivamente para el balance ACTUAL y no para la gráfica.
 if(upToDay===null)return num(Math.max(total,Number(account.withdrawalLocalFloor)||0));
 return num(total);
}
function withdrawalAuditStatus(){
 if(!withdrawalHistoryReady||!teacherSettingsReady)return 'Comprobando con Firebase el historial de retiros aprobados…';
 if(withdrawalAuditConflict)return 'Revisión necesaria: hay retiros aprobados guardados en esta cuenta que no aparecen en la consulta actual de Firebase. Se bloquean nuevos retiros para evitar duplicados.';
 const approved=withdrawalRequests.filter(r=>r.status==='approved');
 const paid=approvedWithdrawalTotal();
 return `Retiros aprobados descontados: ${approved.length} registrado(s) en Firebase · ${money(paid)} en total. Ganancias disponibles ahora: ${money(withdrawable())}.`;
}
function earningsLedger(upToDay=null){
 const paid=approvedWithdrawalTotal(upToDay);
 const grossTeacher=num(testSettings.bonus);
 const grossReferrals=num(account.referrals.reduce((s,r)=>s+num(r.commission),0));
 const grossPlans=num(activePositions().reduce((s,p)=>{
  const days=upToDay===null?elapsedDays(legacyStart(p)):Math.max(0,upToDay-calendarDay(legacyStart(p))+testSettings.extraDays);
  return s+projected(p.amount,p.plan,days,p.rate).profit;
 },0));
 const teacherUsed=Math.min(paid,grossTeacher);
 const referralUsed=Math.min(Math.max(0,num(paid-teacherUsed)),grossReferrals);
 const planUsed=Math.min(Math.max(0,num(paid-teacherUsed-referralUsed)),grossPlans);
 return {grossTeacher,grossReferrals,grossPlans,teacherUsed,referralUsed,planUsed,
  teacherAvailable:Math.max(0,num(grossTeacher-teacherUsed)),
  referralAvailable:Math.max(0,num(grossReferrals-referralUsed)),
  planAvailable:Math.max(0,num(grossPlans-planUsed)),
  approved:paid,uncovered:Math.max(0,num(paid-teacherUsed-referralUsed-planUsed))};
}
function planWithdrawalAllocation(target,upToDay=null){
 let paid=earningsLedger(upToDay).planUsed;
 for(const p of activePositions()){
  const days=upToDay===null?elapsedDays(legacyStart(p)):Math.max(0,upToDay-calendarDay(legacyStart(p))+testSettings.extraDays);
  const gross=projected(p.amount,p.plan,days,p.rate).profit;
  const used=Math.min(paid,gross);
  if(p===target)return num(used);
  paid=num(paid-used);
 }
 return 0;
}
function teacherBonusAvailable(){return earningsSynced()?earningsLedger().teacherAvailable:0;}
function basePlanGain(){return earningsSynced()?earningsLedger().planAvailable:0;}
function gain(){return num(basePlanGain()+teacherBonusAvailable());}
// Rendimiento bruto histórico, sin restar retiros, para mostrar cuánto se generó.
function grossYield(){return num(activePositions().reduce((s,p)=>s+projected(p.amount,p.plan,elapsedDays(legacyStart(p)),p.rate).profit,0)+testSettings.bonus);}
function referralEarned(){return num(account.referrals.reduce((s,r)=>s+num(r.commission),0));}
// Ganancia historica TOTAL: rendimiento bruto + bonos docentes + referidos. No suma depositos de capital.
function historicalEarnedTotal(){return num(grossYield()+referralEarned());}
function referralAvailable(){return earningsSynced()?earningsLedger().referralAvailable:0;}
function withdrawable(){return earningsSynced()?num(gain()+referralAvailable()):0;}
function total(){
 // V9.2: conservar los créditos libres existentes incluso cuando el profesor
 // selecciona un plan de prueba. El capital asignado se muestra por separado;
 // no debe desaparecer al llegar la configuración de Firebase.
 const legacyReferralCash=Math.max(0,num(referralEarned()-(account.referralPaid||0)));
 const otherCash=Math.max(0,num(account.cash-legacyReferralCash));
 return num(otherCash+principal()+gain()+referralAvailable());
}
function lockAnchor(){if(teacherPosition)return legacyStart(teacherPosition);if(account.withdrawalAnchor>0)return account.withdrawalAnchor;const starts=activePositions().map(legacyStart).filter(Number.isFinite);return starts.length?Math.min(...starts):0;}
function hasPendingWithdrawal(){return Boolean(account.pendingWithdrawalRequestId)||withdrawalRequests.some(x=>x.status==='pending');}
function withdrawalStatus(){
 const anchor=lockAnchor();
 if(!anchor)return {days:30,open:false,reason:'El ciclo de 30 días comenzará al activarse un plan. Los retiros anticipados de bonificaciones pueden solicitarse antes.'};
 const remaining=Math.max(0,30-elapsedDays(anchor));
 return {days:remaining,open:remaining===0,reason:remaining>0?`Faltan ${remaining} día${remaining===1?'':'s'} para completar el ciclo. Puedes solicitar antes tus ganancias de práctica disponibles, sujetas a aprobación.`:'Ciclo completado. Los retiros de práctica siguen sujetos a aprobación.'};
}
function renderWithdrawalStatus(){
 const w=withdrawalStatus();
 for(const id of ['actionWithdraw','withdrawInMovements'])$('#'+id).textContent='Retiro';
 $('#withdrawalCountdown').textContent=hasPendingWithdrawal()?`Retiro de práctica pendiente de revisión. ${w.days} día(s) del ciclo restantes.`:w.reason;
 $('#earningDays').textContent=String(w.days);
 const detail=$('#teacherTestStatus');if(detail){detail.hidden=!(testSettings.plan||testSettings.extraDays||testSettings.bonus);detail.textContent=`ESCENARIO DOCENTE · Plan: ${testSettings.plan||'Sin asignación docente'} · ${testSettings.extraDays} día(s) adicionales · ${money(testSettings.bonus)} de ganancia de práctica. Retiros aprobados acumulados: ${money(approvedWithdrawalTotal())}. Solo simulación.`;}
}
// Resumen informativo sincronizado con Firebase. Lo calcula el navegador:
// no es un libro mayor verificado ni prueba la existencia de fondos.
let lastEarningSync='',lastEarningSyncAt=0,earningSyncBusy=false;
function earningSnapshot(){return {
 grossPlanYield:grossYield(),unpaidPlanYield:gain(),referralEarned:referralEarned(),
 referralAvailable:referralAvailable(),availableToRequest:withdrawable(),
 daysRemaining:withdrawalStatus().days,currency:'USDT-DEMO'
};}
async function syncEarningsSummary(force=false){
 if(!sessionReady||session.mode!=='cloud'||earningSyncBusy||!earningsSynced())return;
 const data=earningSnapshot(),fingerprint=JSON.stringify(data),now=Date.now();
 if(!force&&fingerprint===lastEarningSync&&now-lastEarningSyncAt<900000)return;
 earningSyncBusy=true;
 try{await saveVirtualEarningsSummary(session,data);lastEarningSync=fingerprint;lastEarningSyncAt=Date.now();}
 catch(e){console.warn('No se sincronizó el resumen informativo',e);}
 finally{earningSyncBusy=false;}
}

function ledgerRows(){const list=account.ledger;const tr=x=>{let tone=/pendiente|revisión|validación|proceso/i.test(x.status)?'warn':/suspend|rechaz/i.test(x.status)?'danger':'';if(x.kind==='withdraw'&&/^aprobado$/i.test(x.status))tone='ic-withdrawal-approved';if(x.kind==='invest'&&/^activa$/i.test(x.status))tone='ic-plan-activated';const label=tone==='ic-plan-activated'?'Plan activado':x.status;return `<tr><td>${esc(x.name)}</td><td>${esc(x.ref)}</td><td>${x.amount>0?'+ ':''}${money(x.amount)}</td><td>${esc(x.date)}</td><td><span class="tag ${tone}">${esc(label)}</span></td></tr>`;};$('#fullRows').innerHTML=list.length?list.map(tr).join(''):'<tr><td colspan="5">Todavía no hay movimientos.</td></tr>';$('#recentRows').innerHTML=list.length?list.slice(0,4).map(x=>`<tr><td>${esc(x.name)}</td><td>${esc(x.date)}</td><td>${x.amount>0?'+ ':''}${money(x.amount)}</td><td><span class="tag ${x.kind==='withdraw'&&/^aprobado$/i.test(x.status)?'ic-withdrawal-approved':x.kind==='invest'&&/^activa$/i.test(x.status)?'ic-plan-activated':/pendiente|revisión|validación|proceso/i.test(x.status)?'warn':''}">${esc(x.kind==='invest'&&/^activa$/i.test(x.status)?'Plan activado':x.status)}</span></td></tr>`).join(''):'<tr><td colspan="4">Todavía no hay movimientos.</td></tr>';}
// V7: evolución del simulador, no cotizaciones ni rentabilidad real.
// La línea continua llega SOLO hasta hoy; el trazo discontinuo es una PROYECCIÓN hipotética.
function drawPortfolioChart(pos, invested, profit){
 const line=$('#chartLine'), area=$('#chartArea'), caption=$('#chartCaption');
 const svg=line?.ownerSVGElement;
 if(!line||!area||!caption||!svg)return;
 const svgNs='http://www.w3.org/2000/svg';
 function part(id,tag){
  let el=svg.querySelector('#'+id);
  if(!el){el=document.createElementNS(svgNs,tag);el.id=id;svg.appendChild(el);}
  return el;
 }
 const projection=part('chartProjection','polyline');
 const todayMark=part('chartTodayMark','line');
 const nowDot=part('chartNowDot','circle');
 const label=part('chartTodayLabel','text');
 const legendId='chartSimulationLegend';
 let legend=document.getElementById(legendId);
 if(!legend){
  legend=document.createElement('div');legend.id=legendId;
  legend.style.cssText='font-size:11px;line-height:1.55;color:#cdb9de;margin-top:8px';
  caption.insertAdjacentElement('afterend',legend);
 }
 if(!pos.length){
  caption.textContent='Sin posiciones activas. La evolución comienza al asignar capital virtual a un plan.';
  legend.textContent='Simulación educativa · No representa cotizaciones ni pagos reales.';
  line.setAttribute('points','0,210 700,210');
  area.setAttribute('d','M0 210 L700 210 L700 230 L0 230 Z');
  for(const element of [projection,todayMark,nowDot,label])element.setAttribute('visibility','hidden');
  return;
 }
 for(const element of [projection,todayMark,nowDot,label])element.removeAttribute('visibility');
 const today=calendarDay(Date.now());
 const openDays=pos.map(p=>calendarDay(legacyStart(p))).filter(Number.isFinite);
 const firstDay=Math.min(today,...openDays);
 // Historial de hasta 90 días; el resto es una proyección de 30 o 90 días.
 const fromDay=Math.max(firstDay,today-90);
 const toDay=today+chartProjectionDays;
 const xSpan=Math.max(1,toDay-fromDay);
 const positionValue=(p,day)=>{
  const start=calendarDay(legacyStart(p));
  if(day<start)return 0;
  const paid=planWithdrawalAllocation(p,day);
  const profitAtDay=Math.max(0,num(projected(p.amount,p.plan,day-start,p.rate).profit-paid));
  return num(remainingPrincipal(p)+profitAtDay);
 };
 const valueAt=day=>num(pos.reduce((sum,p)=>sum+positionValue(p,day),0));
 // Daily day-by-day model, with maximum 91 history + 91 future datapoints.
 const actualDays=Array.from({length:today-fromDay+1},(_,i)=>fromDay+i);
 const projectedDays=Array.from({length:chartProjectionDays+1},(_,i)=>today+i);
 const actualVals=actualDays.map(valueAt);
 const futureVals=projectedDays.map(valueAt);
 const vals=[...actualVals,...futureVals];
 const minVal=Math.min(...vals),maxVal=Math.max(...vals);
 const breathing=Math.max(1,(maxVal-minVal)*.1);
 const yMin=Math.max(0,minVal-breathing),yMax=maxVal+breathing;
 const px=day=>Number(((day-fromDay)/xSpan*700).toFixed(2));
 const py=v=>Number((210-(v-yMin)/Math.max(1,yMax-yMin)*175).toFixed(2));
 const toPoints=(days,values)=>days.map((day,i)=>`${px(day)},${py(values[i])}`).join(' ');
 const actualPoints=toPoints(actualDays,actualVals);
 line.setAttribute('points',actualPoints);
 line.setAttribute('stroke','#e3bd76');
 line.setAttribute('stroke-width','3.5');
 line.setAttribute('stroke-linejoin','round');
 area.setAttribute('d',`M ${actualPoints.replaceAll(' ',', L ').replaceAll(',',' ')} L ${px(today)} 230 L ${px(fromDay)} 230 Z`);
 const futurePoints=toPoints(projectedDays,futureVals);
 projection.setAttribute('points',futurePoints);
 projection.setAttribute('fill','none');
 projection.setAttribute('stroke','#af83e9');
 projection.setAttribute('stroke-width','2.5');
 projection.setAttribute('stroke-dasharray','9 7');
 projection.setAttribute('stroke-linecap','round');
 projection.setAttribute('stroke-linejoin','round');
 todayMark.setAttribute('x1',px(today));todayMark.setAttribute('x2',px(today));
 todayMark.setAttribute('y1','26');todayMark.setAttribute('y2','213');
 todayMark.setAttribute('stroke','#c5a5ea');todayMark.setAttribute('stroke-width','1.5');
 todayMark.setAttribute('stroke-dasharray','3 6');
 nowDot.setAttribute('cx',px(today));nowDot.setAttribute('cy',py(actualVals.at(-1)));
 nowDot.setAttribute('r','5');nowDot.setAttribute('fill','#e3bd76');
 nowDot.setAttribute('stroke','#190f25');nowDot.setAttribute('stroke-width','2');
 label.setAttribute('x',Math.max(8,Math.min(650,px(today)+8)));
 label.setAttribute('y','24');label.setAttribute('fill','#e9d0fb');label.setAttribute('font-size','12');
 label.textContent='HOY';
 const maxElapsed=Math.max(0,...pos.map(p=>calendarElapsed(legacyStart(p))));
 const dailyEstimated=num(pos.reduce((sum,p)=>{
  const d=calendarElapsed(legacyStart(p));
  const conf=plans[p.plan];
  if(!conf||d>=conf.weeks*7)return sum;
  return sum+(projected(p.amount,p.plan,d+1,p.rate).profit-projected(p.amount,p.plan,d,p.rate).profit);
 },0));
 caption.textContent=`Capital asignado: ${money(invested)} · rendimiento simulado hasta hoy: ${money(profit)} · día ${maxElapsed} desde la primera posición`;
 legend.textContent=`Línea continua: cálculo hasta hoy · Línea discontinua: proyección de práctica de ${chartProjectionDays} días · Próximo incremento estimado: ${money(dailyEstimated)} (mañana).`;
}
function render(){const invested=principal(),profit=gain(),value=total(),pos=activePositions().filter(x=>remainingPrincipal(x)>0||positionProfit(x)>0);
  renderWithdrawalStatus();
  // Antes de recibir los ajustes del profesor y las aprobaciones de Firebase,
  // el valor calculado desde el navegador es provisional. Evitar el destello
  // de $5,100/$0 y su posterior sustitución sin explicación.
  const balancesConfirmed=teacherSettingsReady&&withdrawalHistoryReady;
  $('#totalVal').textContent=balancesConfirmed?money(value):syncDisplay('Sincronizando…');$('#investedVal').textContent=teacherSettingsReady?money(invested):syncDisplay('Sincronizando…');$('#gainVal').textContent=teacherSettingsReady?money(historicalEarnedTotal()):syncDisplay('Sincronizando…');$('#availableVal').textContent=money(withdrawable());$('#historyGeneratedVal').textContent=teacherSettingsReady?money(historicalEarnedTotal()):syncDisplay('Sincronizando…');$('#historyWithdrawnVal').textContent=withdrawalHistoryReady?money(approvedWithdrawalTotal()):syncDisplay('Verificando…');$('#historyAvailableVal').textContent=earningsSynced()?money(withdrawable()):syncDisplay('Verificando…');$('#earningYield').textContent=balancesConfirmed?money(gain()):syncDisplay('Sincronizando…');$('#earningReferrals').textContent=money(referralAvailable());$('#totalDelta').textContent=account.ledger.length?`${account.ledger.length} movimientos registrados`:'Sin movimientos registrados';$('#activeCountVal').textContent=pos.length+' posiciones activas';$('#availabilityStatus').textContent=withdrawalAuditConflict?'Saldo retenido para conciliar los retiros con Firebase':!earningsSynced()?'Sincronizando retiros y ganancias con Firebase…':hasPendingWithdrawal()?'Solicitud de retiro pendiente de revisión':withdrawable()>=MIN_WITHDRAW_DEMO?'Ganancias de práctica disponibles para solicitar · mínimo 50':'Aún no alcanza el mínimo de 50 USDT-DEMO';$('#withdrawalAuditStatus').textContent=withdrawalAuditStatus();
  const notices=['','Actualización de resultados: las posiciones reflejan un nuevo periodo de rendimiento.','Comunicado operativo: los retiros están sujetos a validaciones adicionales.','Comunicado operativo: las solicitudes de retiro están temporalmente suspendidas.'];const note=$('#scenarioNotice');note.classList.toggle('hidden',!stage);note.classList.toggle('negative',stage>=2);note.textContent=notices[stage]||'';
  $('#onboardingNotice').classList.toggle('hidden',account.ledger.length>0);
  $('#portfolioTotalVal').textContent=balancesConfirmed?money(invested+profit):syncDisplay('Sincronizando…');$('#portfolioCountVal').textContent=String(pos.length);$('#portfolioInvestedVal').textContent=teacherSettingsReady?money(invested):syncDisplay('Sincronizando…');$('#portfolioGainVal').textContent=balancesConfirmed?money(profit):syncDisplay('Sincronizando…');
  $('#positionRows').innerHTML=pos.length?pos.map(p=>`<tr><td>${esc(p.plan)}</td><td>${money(remainingPrincipal(p))}</td><td>${money(positionProfit(p))}</td><td>${Math.min(elapsedDays(legacyStart(p)),plans[p.plan].weeks*7)}</td><td>${esc(p.date)}</td><td><span class="tag">Activa</span></td></tr>`).join(''):'<tr><td colspan="6">Aún no tienes posiciones.</td></tr>';
  $('#assetRows').innerHTML=pos.length?pos.map(p=>`<div class="asset-row"><span class="asset-logo">◈</span><span><b>${esc(p.plan)}</b><small>USDT · DEMO</small></span><span class="asset-amount">${money(remainingPrincipal(p))}<small class="up">${positionProfit(p)>0?`+ ${money(positionProfit(p))}`:'Sin variación'}</small></span></div>`).join(''):'<p class="muted empty-state">No tienes activos asignados.</p>';
  drawPortfolioChart(pos,invested,profit);
  $('#supportStatus').textContent=stage===3?'Servicio limitado: solicitudes de retiro suspendidas.':stage===2?'Volumen elevado de consultas; tiempos de respuesta ampliados.':'Los canales de atención están operativos.';
  $('#refCount').textContent=String(account.referrals.length);$('#refCommission').textContent=money(account.referrals.reduce((sum,r)=>sum+r.commission,0));
  $('#refRows').innerHTML=account.referrals.length?account.referrals.slice(0,8).map(r=>`<tr><td>${esc(r.alias)}</td><td>Nivel ${r.level}</td><td>${money(r.amount)}</td><td>+${money(r.commission)}</td></tr>`).join(''):'<tr><td colspan="4">Todavía no hay operaciones de la red.</td></tr>';
  ledgerRows();
  renderWithdrawalRequests();
  void syncEarningsSummary();
}
function setStage(x){stage=Math.min(3,Math.max(0,Number(x)||0));render();}
// V8.3 · Plan seleccionado → cartera de práctica → solicitud → aprobación → posición del plan.
let planActivationRequests=[],planSubmitBusy=false,planSubmitId='';
function choosePlan(plan){
 if(!plans[plan])return;
 rememberChosenPlan(plan);
 setView('planes');showChosenPlanBanner();
 document.getElementById('selectedPlanBanner')?.scrollIntoView({behavior:'smooth',block:'center'});
}
function openPlanWallet(plan){
 const cfg=plans[plan];if(!cfg)return;
 if(planSubmitBusy||planSubmitId||planActivationRequests.some(r=>r.status==='pending')){
  modal('Pendiente de revisión','<div class="notice">Ya existe una solicitud de activación pendiente. Espera la decisión del profesor.</div>');return;
 }
 if(planActivationRequests.some(r=>r.status==='approved'&&r.plan===plan)){
  modal('Plan ya aprobado','<p>El profesor ya aprobó este plan de práctica. Comprueba su activación en tu cartera.</p>');return;
 }
 const amount=num(cfg.min); // El importe se determina exclusivamente por el plan elegido.
 openDemoPaymentMethods(plan,amount); // Abrir directamente métodos, sin pantalla redundante.
}
function openDemoPaymentMethods(plan,amount){
 // Tasa académica fija: NO representa una cotización de mercado.
 const demoRubPerUsdt=95;
 const rubAmount=Math.round(amount*demoRubPerUsdt*100)/100;
 const formatRub=value=>{const [integer,cents]=Number(value).toFixed(2).split('.');return integer.replace(/\B(?=(\d{3})+(?!\d))/g,'.')+','+cents+' ₽ DEMO';};
 // Todas las referencias son identificadores de aula deliberadamente incompatibles
 // con direcciones blockchain y cuentas bancarias reales.
 const methods={
  bep20:{title:'USDT · BEP20',description:'Red BNB Smart Chain',reference:'IC-DEMO-BEP20-'+plan.toUpperCase().replace(/[^A-Z]/g,''),logo:'USDT',logoClass:'usdt'},
  trc20:{title:'USDT · TRC20',description:'Red TRON',reference:'IC-DEMO-TRC20-'+plan.toUpperCase().replace(/[^A-Z]/g,''),logo:'USDT',logoClass:'usdt'},
  rub:{title:'Sberbank · rublos rusos',description:'Rublos rusos · tarjeta Sberbank',reference:'2202 2084 9050 0601',label:'Tarjeta Sberbank · educativa',logo:'SBER',logoClass:'sber'}
 };
 const sberMark='<span class="ic-sber-logo" aria-hidden="true"><svg viewBox="0 0 42 42" focusable="false"><path d="M33 10A16 16 0 1 0 36 25" fill="none" stroke="#9fecc4" stroke-width="5" stroke-linecap="round"/><path d="M11 21l7 7 14-15" fill="none" stroke="#fff" stroke-width="5.4" stroke-linecap="round" stroke-linejoin="round"/></svg></span>';
 const tetherMark='<span class="ic-tether-logo" aria-hidden="true"><svg viewBox="0 0 48 48" focusable="false"><path fill="#fff" d="M11 12h26v6H27v5.4c8 .5 13 2.1 13 4.1s-5 3.5-13 4.1V40h-6v-8.4c-8-.6-13-2.1-13-4.1s5-3.6 13-4.1V18H11zm10 14c-4.7.3-7.8.9-9.3 1.5 1.7.7 4.8 1.2 9.3 1.5zm6 3c4.5-.3 7.6-.8 9.3-1.5-1.5-.6-4.6-1.2-9.3-1.5z"/></svg></span>';
 const bnbMark='<span class="ic-network-logo bnb" aria-hidden="true" title="BNB Smart Chain"><svg viewBox="0 0 48 48" focusable="false"><g fill="#F0B90B"><path d="M24 4 33 13 24 22 15 13zM11 17l7 7-7 7-7-7zM37 17l7 7-7 7-7-7zM24 26l9 9-9 9-9-9zM24 14l10 10-10 10-10-10z"/></g><path d="m24 20 4 4-4 4-4-4z" fill="#121723"/></svg></span>';
 const tronMark='<span class="ic-network-logo tron" aria-hidden="true" title="TRON"><svg viewBox="0 0 48 48" focusable="false"><path d="M8 7 40 16 27 41z" fill="none" stroke="#fff" stroke-width="3.2" stroke-linejoin="round"/><path d="m8 7 16 18 16-9M24 25l3 16M8 7l19 34" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round"/></svg></span>';
 const methodMarks=key=>key==='rub'?sberMark:`<span class="ic-crypto-symbols">${tetherMark}${key==='bep20'?bnbMark:tronMark}</span>`;
 const cards=Object.entries(methods).map(([key,m])=>`<button type="button" class="ic-method-choice" data-ic-method="${key}" aria-pressed="false"><div class="ic-method-head"><div class="ic-method-title"><strong>${esc(m.title)}</strong><small>${esc(m.description)}</small></div>${methodMarks(key)}</div></button>`).join('');
 modal('Elegir método de pago',`
  <div class="ic-payment-brand" aria-hidden="true"><span class="ic-payment-brand-bars">▂ ▅ █</span><strong>INVEST CAPITAL</strong></div>
  <p class="ic-demo-fixed-sum">Importe del plan: <strong>${money(amount)} USDT</strong></p>
  <div class="ic-conversion-display" id="icMethodAmount" role="status" aria-live="polite">Selecciona una opción para ver su importe.</div>
  <div class="ic-method-grid" role="group" aria-label="Métodos de pago de simulación">${cards}</div>
  <div id="icMethodDetail" class="ic-method-detail" aria-live="polite"><p>Selecciona un método para ver su referencia o tarjeta.</p></div>
  <p class="ic-payment-disclosure">Entorno educativo: las referencias y los importes son ilustrativos; no se reciben pagos reales.</p>
  <p id="modalError" class="form-error" hidden></p>
 `,async()=>{
  if(planSubmitBusy||planSubmitId||planActivationRequests.some(r=>r.status==='pending')){err('Ya hay una solicitud pendiente de revisión.');return;}
  const key=modalContent.querySelector('.ic-method-choice[aria-pressed="true"]')?.dataset.icMethod;
  if(!key||!methods[key]){err('Selecciona un método de práctica antes de enviar la solicitud.');return;}
  if(modalContent.dataset.icCopiedMethod!==key){err('Copia primero la referencia del método elegido antes de pulsar «Enviado».');confirmBtn.disabled=true;return;}
  planSubmitBusy=true;confirmBtn.disabled=true;
  try{
   await ensureStudentFirebaseSession();
   // La solicitud existente de Firebase conserva su estructura original:
   // no se alteran reglas, aprobación, saldos ni rendimientos.
   planSubmitId=await requestVirtualPlanActivation(session,plan,alias,amount);
   const displayedAmount=key==='rub'?formatRub(rubAmount):money(amount)+' USDT-DEMO';
   record('plan_requested',`Solicitó activar ${plan} por ${amount.toFixed(2)} USDT-DEMO. Método visual: ${methods[key].title}; equivalencia visual: ${displayedAmount}`,'planes');
   modal('Solicitud enviada para revisión',`<div class="notice"><b>${esc(plan)} · ${money(amount)} USDT-DEMO</b><p>Método seleccionado: ${esc(methods[key].title)}</p><p>Importe mostrado: ${esc(displayedAmount)}</p></div><p>El profesor recibió una única solicitud de activación. El plan no se activa hasta su aprobación.</p><p class="tiny">Conversión fija para el ejercicio: 1 USDT-DEMO = 95 ₽ DEMO. No es un tipo de cambio real ni se reciben fondos.</p>`);
  }catch(e){connectionFailure=e;showFirebaseIssue(e);confirmBtn.disabled=false;}
  finally{planSubmitBusy=false;showChosenPlanBanner();}
 },'Enviado');
 // La selección/copiar no demuestra transferencias: solo desbloquea el reporte de práctica.
 modalContent.dataset.icCopiedMethod='';
 confirmBtn.disabled=true;
 const details=modalContent.querySelector('#icMethodDetail');
 modalContent.querySelectorAll('.ic-method-choice').forEach(button=>button.addEventListener('click',()=>{
  modalContent.dataset.icCopiedMethod='';
  confirmBtn.disabled=true;
  modalContent.querySelectorAll('.ic-method-choice').forEach(other=>other.setAttribute('aria-pressed',String(other===button)));
  const method=methods[button.dataset.icMethod];
  if(!method||!details)return;
  const amountDisplay=modalContent.querySelector('#icMethodAmount');
  if(amountDisplay){
   amountDisplay.innerHTML=button.dataset.icMethod==='rub'
    ?`<small>Equivalente en rublos de práctica</small><strong>${esc(formatRub(rubAmount))}</strong><small>${money(amount)} USDT-DEMO × 95 ₽/USDT · tasa fija de simulación</small>`
    :`<small>Importe para ${esc(method.title)}</small><strong>${money(amount)} USDT-DEMO</strong><small>Sin conversión de divisa</small>`;
  }
  const key=button.dataset.icMethod;
  const isRub=key==='rub';
  const paymentCard=isRub
    ?`<div class="ic-sber-card"><div class="ic-sber-card-heading"><span>Tarjeta Sberbank<br><small>TITULAR: INVEST CAPITAL</small></span>${sberMark}</div><div class="ic-sber-card-number">${esc(method.reference)}</div><span class="ic-sber-card-demo">TARJETA DE CLASE</span></div>`
    :`<div class="ic-usdt-card ${key==='trc20'?'ic-usdt-card-tron':'ic-usdt-card-bnb'}"><div class="ic-usdt-card-heading"><div><strong>USDT · ${key==='bep20'?'BEP20':'TRC20'}</strong><small>${key==='bep20'?'BNB SMART CHAIN':'RED TRON'} · INVEST CAPITAL</small></div>${methodMarks(key)}</div><div class="ic-usdt-card-reference">${esc(method.reference)}</div><span class="ic-usdt-card-caption">REFERENCIA DE CLASE · SIN VALIDEZ BLOCKCHAIN</span></div>`;
  details.innerHTML=`<div class="ic-wallet-head"><span>${esc(method.title)}</span><b>DEMO</b></div>${paymentCard}<div class="ic-demo-copy-row"><code class="ic-demo-copy-value" id="icMethodReference">${esc(method.reference)}</code><button type="button" class="ic-demo-copy-btn" id="icCopyMethodReference">Copiar</button></div><p class="ic-demo-copy-feedback" id="icMethodCopyFeedback" role="status">Copia la referencia y pégala en tu dispositivo. Después pulsa «Enviado» para registrar.</p><small class="ic-card-footnote">${isRub?'Tarjeta ilustrativa de clase: no recibe transferencias.':'Referencia de clase: no permite transferencias de criptomonedas.'}</small>`;
  details.querySelector('#icCopyMethodReference')?.addEventListener('click',async()=>{
   const feedback=details.querySelector('#icMethodCopyFeedback');
   try{
    await navigator.clipboard.writeText(method.reference);
    if(!modalContent.contains(details))return;
    if(modalContent.querySelector('.ic-method-choice[aria-pressed="true"]')?.dataset.icMethod!==button.dataset.icMethod)return;
    modalContent.dataset.icCopiedMethod=button.dataset.icMethod;
    confirmBtn.disabled=false;
    if(feedback)feedback.textContent='Referencia copiada. Después pulsa «Enviado» para registrar.';
   }catch{if(feedback)feedback.textContent='No se pudo copiar. Comprueba los permisos del navegador e inténtalo otra vez.';}
  });
 }));
}

function renderPlanActivationRequests(){
 const box=$('#planActivationBox');if(!box)return;box.replaceChildren();
 const h=document.createElement('h2');h.textContent='Activaciones de planes';box.append(h);
 const tip=document.createElement('p');tip.className='tiny';tip.textContent='Solicitudes de cartera de práctica (USDT DEMO). Solo una aprobación docente activa el plan elegido.';box.append(tip);
 if(!planActivationRequests.length){const p=document.createElement('p');p.className='muted';p.textContent='Aún no has solicitado activar ningún plan.';box.append(p);return;}
 const sorted=[...planActivationRequests].sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
 for(const r of sorted.slice(0,8)){
  const line=document.createElement('div');line.className='credit-request-row';
  const label=document.createElement('strong');label.textContent=`${r.plan} · ${money(r.amount)} DEMO`;
  const state=document.createElement('span');state.className='tag '+(r.status==='approved'?'ic-plan-activated':r.status==='pending'?'warn':r.status==='rejected'?'danger':'');
  state.textContent=r.status==='approved'?'Plan activado':r.status==='rejected'?'Rechazada':'Pendiente de revisión';
  line.append(label,state);box.append(line);
 }
}
function onPlanActivationRequests(rows){
 planActivationRequests=rows;
 if(planSubmitId&&rows.some(r=>r.id===planSubmitId))planSubmitId='';
 let changed=false;
 for(const r of rows){
  if(r.status!=='approved'||account.activatedPlanRequestIds[r.id])continue;
  const plan=plans[r.plan],amount=num(r.amount);
  if(!plan||!Number.isFinite(amount)||amount<plan.min||amount>100000)continue;
  // Cada ID aprobado se aplica una vez. El importe se convierte directamente en
  // posición del plan indicado y NUNCA pasa por account.cash.
  account.activatedPlanRequestIds[r.id]=true;
  const started=timestampMs(r.decisionAt)||timestampMs(r.createdAt)||Date.now();
  account.positions.push({plan:r.plan,amount,rate:plan.rate,date:new Date(started).toLocaleDateString('es-ES'),openedAt:started,paidProfit:0,principalPaid:0,activationRequestId:r.id});
  // Mantiene las actividades del ejercicio de referidos, con el mismo ID único.
  pendingContributions.push({amount,reference:r.id.slice(0,35)});
  if(!lockAnchor())account.withdrawalAnchor=started;
  tx('Activación de práctica de plan '+r.plan,amount,'Activa','invest');
  record('plan_assign',`Activó ${r.plan} con ${amount.toFixed(2)} USDT DEMO tras aprobación`,'planes');
  changed=true;
 }
 if(changed){save();render();void flushContributions();}
 renderPlanActivationRequests();showChosenPlanBanner();
}
// Todos los botones «Invertir» llegan a la cartera demo del plan elegido.
// Si no hay un plan pendiente, un selector breve permite abrir la misma cartera.
function startPlanInvestment(){
 const selected=currentChosenPlan();
 const approved=planActivationRequests.some(r=>r.plan===selected&&r.status==='approved');
 if(plans[selected]&&!approved){openPlanWallet(selected);return;}
 const entries=Object.entries(plans).map(([name,p])=>
   `<button type="button" class="btn btn-soft" data-choose-wallet-plan="${esc(name)}" style="width:100%;justify-content:space-between;margin:5px 0">${esc(name)} · ${money(p.min)} DEMO</button>`).join('');
 modal('Seleccionar plan para la cartera de práctica',`<p>Elige el plan que deseas activar. Cada plan requiere una solicitud propia y la aprobación del profesor.</p><div>${entries}</div><p class="tiny">Todo el proceso es de práctica; no se envían criptomonedas.</p>`);
 modalContent.querySelectorAll('[data-choose-wallet-plan]').forEach(b=>b.addEventListener('click',()=>{
  const p=b.dataset.chooseWalletPlan;rememberChosenPlan(p);showChosenPlanBanner();openPlanWallet(p);
 }));
}
// Solicitudes de crédito anteriores: se conservan únicamente para mostrar su historial
// y reconstruir saldos ya aprobados. No se crean créditos libres desde la interfaz V9.3.
let creditRequests=[],withdrawalRequests=[],creditSubmissionInFlight=false,justSubmittedCreditId='';
function renderCreditRequests(){
 const box=$('#creditRequestBox');if(!box)return;
 box.replaceChildren();
 const rows=[...creditRequests].sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
 const pending=rows.filter(r=>r.status==='pending');
 const heading=document.createElement('h2');heading.textContent=`Solicitudes de inversión virtual ${pending.length?'· '+pending.length+' pendiente(s)':''}`;box.append(heading);
 const note=document.createElement('p');note.className='tiny';note.textContent='Importes de práctica para el aula. Ninguna solicitud aumenta tu saldo antes de la aprobación del profesor.';box.append(note);
 if(!rows.length){const empty=document.createElement('p');empty.className='muted';empty.textContent='Todavía no has enviado solicitudes.';box.append(empty);return;}
 for(const req of rows.slice(0,8)){
  const line=document.createElement('div');line.className='credit-request-row';
  const amount=document.createElement('strong');amount.textContent=money(req.amount||0)+' · Simulado';
  const state=document.createElement('span');const kind=req.status==='approved'?'Aprobada y acreditada':req.status==='rejected'?'Rechazada':'Pendiente de revisión';
  state.textContent=kind;state.className='tag '+(req.status==='pending'?'warn':req.status==='rejected'?'danger':'');
  line.append(amount,state);box.append(line);
 }
 const approved=rows.filter(r=>r.status==='approved');
 const approvedAmount=num(approved.reduce((sum,r)=>sum+num(r.amount),0));
 const summary=document.createElement('p');summary.className='tiny';
 summary.textContent=`Aprobaciones registradas en Firebase: ${approved.length} · Capital de práctica aprobado: ${money(approvedAmount)}. El saldo de la cuenta también puede incluir movimientos anteriores, asignaciones y bonificaciones simuladas.`;
 box.append(summary);
 if(approved.length>1){
  const amounts=new Map();
  for(const r of approved){const n=num(r.amount);amounts.set(n,(amounts.get(n)||0)+1);}
  const repeated=[...amounts].filter(([n,c])=>n>=1&&c>1);
  if(repeated.length){const warning=document.createElement('p');warning.className='notice';
   warning.textContent='Hay varias aprobaciones por el mismo importe ('+repeated.map(([n,c])=>c+' × '+money(n)).join(', ')+'). Pide al profesor que compruebe si corresponden a solicitudes distintas o a un duplicado.';
   box.append(warning);
  }
 }
}
function onCreditRequests(rows){
 creditRequests=rows;
 if(justSubmittedCreditId && rows.some(r=>r.id===justSubmittedCreditId))justSubmittedCreditId='';
 let changed=false;
 // V6.1: al actualizar desde V5, las aprobaciones ya estaban acreditadas,
 // pero la fecha inicial del calendario aún no existía en los datos locales.
 // Solo migramos cuando no hay fecha guardada; nunca duplicamos saldos.
 const needsCalendarMigration=!(account.withdrawalAnchor>0);
 for(const req of rows){
  if(req.status!=='approved'||account.approvedRequestIds[req.id])continue;
  const n=num(req.amount);
  if(!Number.isFinite(n)||n<1||n>100000)continue;
  // Un identificador de Firestore solo puede convertirse una vez en saldo del navegador.
  account.approvedRequestIds[req.id]=true;
  account.cash=num(account.cash+n);
  if(!lockAnchor())account.withdrawalAnchor=timestampMs(req.decisionAt)||timestampMs(req.createdAt)||Date.now();
  pendingContributions.push({amount:n,reference:req.id.slice(0,35)});
  tx('Crédito virtual aprobado por el profesor',n,'Acreditado','deposit');
  record('deposit_confirmed',`Se acreditaron ${n.toFixed(2)} USDT de práctica tras aprobación docente`);
  changed=true;
 }
 if(needsCalendarMigration){
  const dates=rows
   .filter(r=>r.status==='approved'&&account.approvedRequestIds[r.id])
   .map(r=>timestampMs(r.decisionAt)||timestampMs(r.createdAt))
   .filter(t=>Number.isFinite(t)&&t>0&&t<=Date.now()+MS_DAY);
  if(dates.length){
   const firstApproval=Math.min(...dates);
   if(account.withdrawalAnchor!==firstApproval){account.withdrawalAnchor=firstApproval;changed=true;}
  }
 }
 if(changed){save();render();void flushContributions();}
 renderCreditRequests();
 showChosenPlanBanner();
}
// No se activa un plan mediante saldo libre. Cada plan necesita su aprobación propia.
// Seleccionar no es solicitar: la única escritura de solicitud ocurre tras confirmar en la cartera.
function planSelect(plan){choosePlan(plan);}


function renderWithdrawalRequests(){
 const box=$('#withdrawRequestBox');if(!box)return;
 box.replaceChildren();
 const ordered=[...withdrawalRequests].sort((a,b)=>(timestampMs(b.createdAt)||0)-(timestampMs(a.createdAt)||0));
 const pending=ordered.filter(r=>r.status==='pending');
 const heading=document.createElement('h2');heading.textContent='Solicitudes de retiro de práctica'+(pending.length?` · ${pending.length} pendiente(s)`:'');box.append(heading);
 box.append(Object.assign(document.createElement('p'),{className:'tiny',textContent:'Simulación educativa: ninguna aprobación transfiere dinero ni criptomonedas.'}));
 if(!ordered.length){box.append(Object.assign(document.createElement('p'),{className:'muted',textContent:'Todavía no hay solicitudes de retiro.'}));return;}
 for(const r of ordered.slice(0,8)){
  const row=document.createElement('div');row.className='credit-request-row';
  const amount=document.createElement('strong');amount.textContent=money(r.amount)+' · virtual';
  const state=document.createElement('span');state.className='tag '+(r.status==='approved'?'ic-withdrawal-approved':r.status==='pending'?'warn':r.status==='rejected'?'danger':'');
  state.textContent=r.status==='approved'?'Aprobada · saldo virtual descontado':r.status==='rejected'?'Rechazada':'Pendiente de revisión';
  row.append(amount,state);box.append(row);
 }
}
// V8.8 · No debitar las ganancias únicamente en localStorage.
// El descuento confirmado se deriva siempre de las solicitudes aprobadas en Firebase.
function onWithdrawalRequests(rows){
 withdrawalRequests=rows;
 let changed=false;
 // La aprobación se conserva POR ID. Esto impide que una recarga borre el
 // descuento si llega un snapshot incompleto o de una cuenta equivocada.
 for(const r of rows){
  if(r.status!=='approved'||!r.id)continue;
  const amount=Number(r.amount);
  if(!Number.isFinite(amount)||amount<MIN_WITHDRAW_DEMO||amount>100000)continue;
  const when=timestampMs(r.decisionAt)||timestampMs(r.createdAt)||0;
  const old=account.approvedWithdrawalReceipts[r.id];
  if(!old||Number(old.amount)!==amount||(!Number(old.when)&&when)){
   account.approvedWithdrawalReceipts[r.id]={amount,when};changed=true;
  }
 }
 // Una vez recibido un snapshot confirmado por servidor, ningún retiro
 // aprobado local puede desaparecer silenciosamente. Si falta un ID, no se
 // permiten solicitudes nuevas hasta comprobar el UID y los datos en Firebase.
 const remoteIds=new Set(rows.filter(r=>r.status==='approved').map(r=>r.id));
 withdrawalAuditConflict=withdrawalHistoryReady&&
  Object.keys(account.approvedWithdrawalReceipts||{}).some(id=>!remoteIds.has(id));
 if(changed)save();
 if(!earningsSynced()){render();return;}
 for(const r of [...rows].sort((a,b)=>(timestampMs(a.decisionAt)||0)-(timestampMs(b.decisionAt)||0))){
  if(!['approved','rejected'].includes(r.status)||account.reviewedWithdrawalIds[r.id])continue;
  const when=timestampMs(r.decisionAt)||Date.now();
  if(r.status==='approved'){
   const amount=num(r.amount);
   if(!Number.isFinite(amount)||amount<MIN_WITHDRAW_DEMO)continue;
   account.reviewedWithdrawalIds[r.id]='approved';
   account.pendingWithdrawalRequestId='';
   // El balance ya está descontado por approvedWithdrawalTotal() en Firebase.
   tx('Retiro de práctica aprobado por el profesor',-amount,'Aprobado','withdraw');
   record('withdraw_approved',`Retiro virtual aprobado por ${amount.toFixed(2)} USDT`,'movimientos');
  }else{
   account.reviewedWithdrawalIds[r.id]='rejected';
   // Un rechazo no reinicia los días ya transcurridos.
   account.pendingWithdrawalRequestId='';
   tx('Retiro de práctica rechazado por el profesor',0,'Rechazado','withdraw');
   record('withdraw_rejected',`Retiro virtual rechazado de ${num(r.amount).toFixed(2)} USDT`,'movimientos');
  }
  changed=true;
 }
 if(!rows.some(r=>r.status==='pending')&&account.pendingWithdrawalRequestId){
  const own=rows.find(r=>r.id===account.pendingWithdrawalRequestId);
  if(own&&own.status!=='pending'&&account.reviewedWithdrawalIds[own.id]){account.pendingWithdrawalRequestId='';changed=true;}
 }
 if(changed)save();
 render();
}
function withdrawal(){
 record('withdraw_open','Consultó retiro de práctica de ganancias','movimientos');
 const w=withdrawalStatus();
 if(!earningsSynced()){modal('Retiro no disponible',`<p>${esc(withdrawalAuditStatus())}</p><p>Para evitar un retiro de práctica duplicado, no se pueden crear solicitudes hasta completar la comprobación.</p>`);return;}
 if(hasPendingWithdrawal()){
  modal('Pendiente de revisión',`<div class="notice">Ya tienes una solicitud de retiro de práctica pendiente. El profesor recibirá el aviso aunque el ciclo tenga ${w.days} día(s) restantes.</div>`);return;
 }
 if(stage===3){modal('Escenario suspendido','<div class="notice negative">La clase está en un escenario de retiros suspendidos.</div>');return;}
 const cap=withdrawable();
 if(cap<MIN_WITHDRAW_DEMO){
  modal('Aún no tienes ganancias disponibles',`<p>Hoy no alcanzas el mínimo de 50 USDT-DEMO para solicitar un retiro.</p><p>Rendimiento sin retirar: <b>${money(gain())}</b> · Bonificaciones disponibles: <b>${money(referralAvailable())}</b>.</p><p class="tiny">El ciclo tiene ${w.days} día(s) restantes, pero no impide solicitar bonificaciones o ganancias en cuanto se acumulen.</p>`);return;
 }
 modal('Solicitar retiro anticipado · DEMO',`
  <div class="modal-note"><strong>SIMULACIÓN EDUCATIVA</strong>. No se transfiere dinero ni USDT real.</div>
  <p>Rendimiento virtual no retirado: <b>${money(gain())}</b></p>
  <p>Bonificaciones de referidos: <b>${money(referralAvailable())}</b></p>
  <p>Ganancia disponible: <strong>${money(cap)} de práctica</strong></p>
  <div class="notice">${w.days} día(s) del ciclo restantes. Puedes solicitar ahora un retiro de práctica anticipado. <b>El profesor decide si lo aprueba o rechaza.</b></div>
  <label class="field-label" for="amountValue">Importe de ganancias de práctica (USDT-DEMO)</label>
  <input id="amountValue" class="plain-input" type="number" step="0.01" min="50" max="${cap}" value="${Math.max(50,Math.min(100,cap))}">
  <p id="modalError" class="form-error" hidden></p>
  <p class="tiny">Ni el capital asignado ni los antiguos créditos libres cuentan como ganancia retirable.</p>
 `,async()=>{
  const raw=$('#amountValue').value,n=num(Number(raw));
  if(!raw.trim()||!Number.isFinite(Number(raw))||n<MIN_WITHDRAW_DEMO||n>withdrawable()){err('Indica una cantidad de al menos 50 USDT-DEMO y como máximo la ganancia disponible.');return;}
  if(hasPendingWithdrawal()){err('Ya existe una solicitud de retiro pendiente.');return;}
  confirmBtn.disabled=true;
  try{
   await ensureStudentFirebaseSession();
   await syncEarningsSummary(true);
   const id=await requestVirtualWithdrawal(session,n,alias);
   account.pendingWithdrawalRequestId=id;save();
   record('withdraw_attempt',`Solicitó retirar ${n.toFixed(2)} USDT de práctica con ${w.days} días pendientes`,'movimientos');
   render();
   modal('Solicitud pendiente',`<div class="notice"><strong>${money(n)} USDT-DEMO · Pendiente de revisión</strong></div><p>El profesor recibió la solicitud aun faltando ${w.days} día(s) del ciclo. Al aprobarla, se descontará de las ganancias de práctica disponibles; si la rechaza, conservarás la cantidad y el contador seguirá avanzando.</p>`);
  }catch(e){err('No se pudo enviar a Firebase: '+e.message);confirmBtn.disabled=false;}
 },'Enviar solicitud al profesor');
}
// Una aportación realizada en el aula notifica a las cuentas antecesoras (hasta 3 niveles).
// La comisión se calcula desde ese movimiento, no desde formularios manuales.
let contributionsBusy=false;
async function flushContributions(){
 if(contributionsBusy||!sessionReady||session.mode!=='cloud')return;
 contributionsBusy=true;
 try{
  while(pendingContributions.length){
    const p=pendingContributions[0];
    await recordClassroomContribution(session,p.amount,p.reference);
    pendingContributions.shift();save();
  }
 }catch(e){
  $('#refLinkStatus').textContent='Contribución pendiente de sincronizar: '+e.message;
  console.warn('No se pudo sincronizar el aporte en la red de aula',e);
 }finally{contributionsBusy=false;}
}
async function applyClassroomCode(code){
 const current=await getClassroomLink(session);
 if(current){
   if(code && classroomCode(current)!==code)throw new Error('Tu cuenta ya tiene un compañero asociado.');
   $('#refLinkStatus').textContent='Vinculado al código '+classroomCode(current);
   return;
 }
 if(!code){$('#refLinkStatus').textContent='Tu cuenta todavía no está vinculada a otro alumno.';return;}
 await linkClassroomMember(session,code);
 $('#refLinkStatus').textContent='Vínculo confirmado con '+code;
 record('referral_link','Se vinculó a la cuenta de un compañero: '+code,'referidos');
}
function onClassroomRewards(rows){
 let changed=false;
 for(const item of rows){
  const level=item.ancestors?.indexOf(session.uid)+1;
  if(!referralRates[level]||!(item.amount>=1&&item.amount<=100000)||account.referralCreditedIds[item.id])continue;
  const commission=num(item.amount*referralRates[level]);
  account.referralCreditedIds[item.id]=true;
  account.cash=num(account.cash+commission);
  account.referrals.unshift({alias:String(item.sourceTag||'Alumno del aula'),level,amount:num(item.amount),commission,createdAt:Date.now(),eventId:item.id});
  account.referrals=account.referrals.slice(0,100);
  tx('Bonificación virtual de red · nivel '+level,commission,'Registrada','referral');
  record('referral_credit',`Bonificación virtual automática de ${commission.toFixed(2)} USDT en nivel ${level}`,'referidos');
  changed=true;
 }
 if(changed){save();render();}
}
// Red hipotética: se introducen aportaciones inventadas por nivel, nunca invitaciones ni fondos reales.
function referralActivity(){
 if(session.mode==='cloud'){
   record('referral_open','Abrió vínculo de compañero','referidos');
   modal('Vincular compañero',`<p>Introduce el código IC- que te dio otro alumno durante la actividad del aula. Solo puedes elegirlo una vez.</p><label class="field-label" for="classroomRefInput">Código de compañero</label><input class="plain-input" id="classroomRefInput" spellcheck="false" maxlength="72" placeholder="IC-…"><p id="modalError" class="form-error" hidden></p>`,async()=>{
     const code=$('#classroomRefInput').value.trim();confirmBtn.disabled=true;
     try{await applyClassroomCode(code);modal('Asociación registrada','<p>El vínculo del aula quedó guardado en Firebase.</p>');}
     catch(e){err('No se pudo asociar: '+e.message);confirmBtn.disabled=false;}
   },'Confirmar vínculo');
   return;
 }
 record('referral_open' ,'Consultó operaciones de asociados','referidos');modal('Nueva operación de asociados',`<p>Introduce un caso de la red para calcular la bonificación aplicable.</p><label class="field-label" for="refAliasInput">Identificador del asociado</label><input class="plain-input" id="refAliasInput" maxlength="40" placeholder="Ej. Asociado A"><label class="field-label" for="refLevelInput">Nivel de la red</label><select class="plain-input" id="refLevelInput"><option value="1">Nivel 1 · 15 %</option><option value="2">Nivel 2 · 5 %</option><option value="3">Nivel 3 · 3 %</option></select><label class="field-label" for="refAmountInput">Aportación registrada del asociado (USDT)</label><input class="plain-input" id="refAmountInput" type="number" min="1" max="100000" value="100" step="0.01"><p id="modalError" class="form-error" hidden></p>`,()=>{
 const name=$('#refAliasInput').value.trim(),level=Number($('#refLevelInput').value),raw=Number($('#refAmountInput').value),amount=num(raw);
 if(name.length<2||name.length>40){err('Introduce un identificador de entre 2 y 40 caracteres.');return;}
 if(!referralRates[level]||!Number.isFinite(raw)||amount<1||amount>100000){err('Selecciona un nivel y una aportación válida de 1 a 100.000 USDT.');return;}
 const commission=num(amount*referralRates[level]);account.referrals.unshift({alias:name,level,amount,commission,createdAt:Date.now()});account.referrals=account.referrals.slice(0,100);account.cash=num(account.cash+commission);if(!lockAnchor())account.withdrawalAnchor=Date.now();tx('Comisión asociados · nivel '+level,commission,'Registrada','referral');record('referral_credit',`Bonificación de red nivel ${level}: ${commission.toFixed(2)} USDT por aporte de ${amount.toFixed(2)} USDT`,'referidos');modal('Comisión registrada',`<p>Se añadió una bonificación de <strong>${money(commission)}</strong> al saldo virtual de tu cuenta.</p><p>Corresponde al <strong>${referralRates[level]*100} %</strong> de la aportación registrada del nivel ${level}.</p>`);
 },'Registrar comisión');}
const docs={'Resumen de servicios':'La entidad declara servicios digitales de gestión de cartera. Los registros son internos. No se detallan custodios ni contrapartes independientes.','Metodología de resultados':'Los resultados comunicados proceden de registros internos. La metodología detallada y la auditoría independiente no se adjuntan.','Estado de registros y autorizaciones':'Número de licencia para gestión de inversiones: no proporcionado. Autoridad supervisora: no identificada en el expediente.','Condiciones de salida':'Las solicitudes pueden quedar sujetas a validaciones y disponibilidad de liquidez. No se garantiza un plazo fijo de procesamiento.'};
function updateCalculator(){
 const plan=$('#calcPlan').value,amountRaw=$('#calcCapital').value,dayRaw=$('#calcDays').value;
 const capital=Number(amountRaw),days=Number(dayRaw),conf=plans[plan];
 const valid=conf&&amountRaw.trim()!==''&&dayRaw.trim()!==''&&Number.isFinite(capital)&&capital>=0&&capital<=1000000&&Number.isInteger(days)&&days>=0&&days<=365;
 $('#calcValidation').textContent=valid?'':'Introduce capital entre 0 y 1.000.000 USDT y entre 0 y 365 días enteros.';
 const out=valid?projected(capital,plan,days):{profit:0,total:0,effectiveDays:0};
 $('#calcTotal').textContent=valid?money(out.total):'—';
 $('#calcPrincipal').textContent=valid?money(capital):'—';
 $('#calcProfit').textContent=valid?'+'+money(out.profit):'—';
 $('#calcEffectiveDays').textContent=valid?`${out.effectiveDays} de ${days} días`:'—';
 $('#calcRate').textContent=valid?`${(conf.rate*100).toLocaleString('es-ES',{maximumFractionDigits:1})} %`:'—';
 const growth=valid&&capital>0?Math.min(.9,Math.max(0,out.profit/capital)):0;
 const pts=Array.from({length:9},(_,i)=>`${Math.round(i*70)},${Math.round(130-90*growth*(i/8))}`).join(' ');
 $('#calcLine').setAttribute('points',pts);$('#calcArea').setAttribute('d','M'+pts.split(' ').map(p=>p.replace(',',' ')).join(' L')+' L560 150 L0 150 Z');
 $$('.calc-quickdays button').forEach(b=>b.classList.toggle('active',Number(b.dataset.calcDays)===days));
}
['calcPlan','calcCapital','calcDays'].forEach(id=>$('#'+id).addEventListener('input',updateCalculator));
$$('[data-calc-days]').forEach(button=>button.addEventListener('click',()=>{$('#calcDays').value=button.dataset.calcDays;updateCalculator();record('calculator',`Consultó proyección a ${button.dataset.calcDays} días`,'calculadora');}));
$('#calcPlan').addEventListener('change',()=>{const p=plans[$('#calcPlan').value];if(Number($('#calcCapital').value)<p.min)$('#calcCapital').value=p.min;updateCalculator();});
['calcCapital','calcDays'].forEach(id=>$('#'+id).addEventListener('change',()=>record('calculator',`Simuló ${$('#calcCapital').value} USDT durante ${$('#calcDays').value} días en ${$('#calcPlan').value}`,'calculadora')));
updateCalculator();
$$('.side-link').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));$$('[data-goto]').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.goto)));$$('[data-period]').forEach(b=>{
 const isShort=b.dataset.period==='6M';
 b.dataset.projectionDays=isShort?'30':'90';
 b.textContent=isShort?'30D':'90D';
 b.setAttribute('title',`Proyección simulada a ${b.dataset.projectionDays} días`);
 b.addEventListener('click',()=>{
  chartProjectionDays=Number(b.dataset.projectionDays);
  $$('[data-period]').forEach(a=>a.classList.toggle('active',a===b));
  render();
  record('chart',`Consultó proyección de práctica de ${chartProjectionDays} días`);
 });
});
$$('[data-plan]').forEach(b=>b.addEventListener('click',()=>planSelect(b.dataset.plan)));
$$('[data-document]').forEach(b=>b.addEventListener('click',()=>{const name=b.dataset.document;record('document','Consultó '+name,'documentos');modal(name,`<p>${esc(docs[name]||'Documento no disponible.')}</p>`);}));
$('#sideInvest').addEventListener('click',()=>{closeMobileNav();startPlanInvestment();});$('#actionDeposit').addEventListener('click',startPlanInvestment);$('#startDeposit').addEventListener('click',startPlanInvestment);$('#actionWithdraw').addEventListener('click',withdrawal);$('#withdrawInMovements').addEventListener('click',withdrawal);
$('#newReferralActivity').addEventListener('click',referralActivity);
$('#copyRef').addEventListener('click',async()=>{record('referral','Consultó identificador del programa','referidos');try{await navigator.clipboard.writeText($('#refCode').textContent.trim());modal('Identificador de asociado','Copiado al portapapeles.');}catch{modal('Identificador de asociado',esc($('#refCode').textContent));}});
// Soporte Telegram: solo se confirma al recibir una respuesta exitosa del servidor.
// El token de BotFather NUNCA se expone al navegador ni a GitHub.
const SUPPORT_WORKER_URL='https://investcapital-soporte.investcapital8310.workers.dev/support';
const SUPPORT_THREADS_URL='https://investcapital-soporte.investcapital8310.workers.dev/threads';
let sendingSupport=false;
$('#sendSupport').addEventListener('click',async()=>{
 if(sendingSupport)return;
 const subject=$('#supportSubject').value.trim();
 const message=$('#supportText').value.trim();
 if(subject.length<3||subject.length>100||message.length<10||message.length>1500){
  modal('Falta información','Selecciona un motivo y escribe una consulta de al menos 10 caracteres.');return;
 }
 const btn=$('#sendSupport');sendingSupport=true;btn.disabled=true;btn.textContent='Enviando…';
 try{
  await ensureStudentFirebaseSession();
  const firebase=await getFirebase();
  const user=firebase?.auth?.currentUser;
  if(!user)throw new Error('Debes iniciar sesión como alumno.');
  const idToken=await user.getIdToken();
  const response=await fetch(SUPPORT_WORKER_URL,{
   method:'POST',
   headers:{'Content-Type':'application/json','Authorization':'Bearer '+idToken},
   body:JSON.stringify({subject,message})
  });
  const result=await response.json().catch(()=>({}));
  if(!response.ok||result.ok!==true)throw new Error(result.error||'No se pudo entregar la consulta al soporte.');
  record('support','Envió consulta: '+subject,'soporte');
  $('#supportText').value='';
  tx('Consulta · '+subject,0,'Enviada','support');
  modal('Consulta enviada','Tu mensaje fue enviado al soporte.');
  if(view==='soporte')void loadSupportReplies();
 }catch(error){
  console.error('Error al enviar consulta a soporte',error);
  modal('No se pudo enviar',esc(error?.message||'Revisa la conexión y vuelve a intentarlo.'));
 }finally{sendingSupport=false;btn.disabled=false;btn.textContent='Enviar consulta';}
});
$('#closeModal').addEventListener('click',close);overlay.addEventListener('click',e=>{if(e.target===overlay)close();});window.addEventListener('keydown',e=>{if(e.key==='Escape')close();});confirmBtn.addEventListener('click',()=>onConfirm?.());
// Histórico de respuestas privadas de soporte, cargadas solo con la sesión del alumno.
const supportSection=document.querySelector('[data-section="soporte"]');
const supportHistory=document.createElement('div');
supportHistory.style.cssText='margin-top:20px;padding:18px;border:1px solid #7952a6;border-radius:14px;background:rgba(35,18,60,.5)';
const supportTitle=document.createElement('h3');supportTitle.textContent='Mis consultas y respuestas';supportTitle.style.margin='0 0 12px';
const supportList=document.createElement('div');supportList.textContent='Abre Soporte para consultar tus mensajes.';
supportHistory.append(supportTitle,supportList);supportSection?.append(supportHistory);
let supportLoading=false;
async function loadSupportReplies(){
 if(supportLoading||view!=='soporte')return;
 supportLoading=true;
 try{
  await ensureStudentFirebaseSession();
  const fb=await getFirebase();const token=await fb?.auth?.currentUser?.getIdToken();
  if(!token)throw new Error('Inicia sesión para ver las consultas.');
  const result=await fetch(SUPPORT_THREADS_URL,{headers:{Authorization:'Bearer '+token}});
  const json=await result.json();if(!result.ok||!json.ok)throw new Error(json.error||'No se pudieron cargar las respuestas');
  supportList.replaceChildren();
  if(!json.tickets?.length){supportList.textContent='Aún no tienes consultas registradas.';return;}
  for(const item of json.tickets){
   const card=document.createElement('div');card.style.cssText='padding:12px 0;border-top:1px solid #765a99;white-space:pre-wrap;overflow-wrap:anywhere';
   const heading=document.createElement('strong');heading.textContent=item.subject+' · '+(item.status==='respondida'?'Respondida':'Pendiente');
   const question=document.createElement('p');question.textContent='Tu mensaje: '+item.message;
   const answer=document.createElement('p');answer.style.cssText='font-weight:600;color:#d7c5ff';answer.textContent=item.response?'Soporte: '+item.response:'Esperando respuesta del equipo de soporte.';
   card.append(heading,question,answer);supportList.append(card);
  }
 }catch(e){supportList.textContent='No se pudo consultar el historial: '+(e?.message||'Error de conexión');}
 finally{supportLoading=false;}
}
// Las respuestas se actualizan al entrar en Soporte y mientras esa sección está abierta.
for(const btn of document.querySelectorAll('.side-link'))if(btn.dataset.view==='soporte')btn.addEventListener('click',()=>void loadSupportReplies());
setInterval(()=>{if(view==='soporte')void loadSupportReplies()},20000);
const exit=document.createElement('button');exit.className='btn btn-soft';exit.textContent='Cerrar sesión';exit.style.marginTop='12px';exit.addEventListener('click',async()=>{record('exit','Cerró sesión');await flush();try{const f=await getFirebase();if(f?.auth.currentUser)await f.Auth.signOut(f.auth);}catch{}localStorage.removeItem('ic_v3_alias');localStorage.removeItem('ic_v3_profile');localStorage.removeItem('ic_v3_consent');localStorage.removeItem('ic_v3_auth_uid');location.replace('index.html?login=1');});$('.side-foot').append(exit);
$('#userAlias').textContent=alias;$('#refCode').textContent='Conectando…';render();renderCreditRequests();renderWithdrawalRequests();renderPlanActivationRequests();showChosenPlanBanner();
async function attachStudentListeners(){
 unsubscribe();unsubscribeRewards();unsubscribeCredits();unsubscribeWithdrawals();unsubscribePlanRequests();unsubscribeTeacherSettings();
 teacherSettingsReady=false;withdrawalHistoryReady=false;syncFailureMessage='';
 if(syncWatchdog)clearTimeout(syncWatchdog);
 syncWatchdog=setTimeout(()=>{
  if(!teacherSettingsReady||!withdrawalHistoryReady)
   reportSyncFailure('Tiempo de espera','Firebase no confirmó ajustes o retiros en 15 segundos. Comprueba la conexión y las reglas de Firestore.');
 },15000);
 unsubscribeTeacherSettings=watchStudentTeacherSettings(session,(data,serverConfirmed)=>{
  testSettings={extraDays:Math.min(365,Math.max(0,Math.floor(Number(data.extraDays)||0))),bonus:Math.min(100000,Math.max(0,num(data.bonus))),plan:plans[data.plan]?data.plan:'',planStartedAt:Number(data.planStartedAt)||0};
  syncTeacherPosition();
  // Un escenario docente no debe sobrescribir el plan elegido expresamente en la portada.
  if(testSettings.plan && !currentChosenPlan())rememberChosenPlan(testSettings.plan);
  teacherSettingsReady=serverConfirmed;
  onWithdrawalRequests(withdrawalRequests);
  showChosenPlanBanner();void syncEarningsSummary(true);
 },e=>{reportSyncFailure('Ajustes del profesor',e);});
 unsubscribe=watchStage(session,setStage,()=>{$('#syncStatus').textContent='No se pudo leer el escenario';});
 if(session.mode==='cloud'){
  try{await applyClassroomCode(profile.referralCode||'');}
  catch(e){$('#refLinkStatus').textContent='El código indicado no pudo vincularse: '+e.message+' Puedes corregirlo aquí.';}
  unsubscribeCredits=watchVirtualCreditRequests(session,onCreditRequests,e=>{console.error('Error leyendo solicitudes',e);const box=$('#creditRequestBox');if(box)box.textContent='No se pudieron consultar las solicitudes: '+e.message;});
  unsubscribePlanRequests=watchVirtualPlanRequests(session,onPlanActivationRequests,e=>{console.error('Error leyendo activaciones',e);const box=$('#planActivationBox');if(box)box.textContent='No se pudieron consultar activaciones: '+e.message;});
  unsubscribeWithdrawals=watchVirtualWithdrawalRequests(session,(rows,serverConfirmed)=>{withdrawalHistoryReady=serverConfirmed;onWithdrawalRequests(rows);void syncEarningsSummary(true);},e=>{console.error('Error leyendo retiros virtuales',e);$('#withdrawRequestBox').textContent='No se pudieron consultar solicitudes de retiro: '+e.message;reportSyncFailure('Solicitudes de retiro',e);});
  unsubscribeRewards=watchClassroomRewards(session,onClassroomRewards,e=>{$('#refLinkStatus').textContent='No se pudo cargar la red: '+e.message;});
  await flushContributions();
 }else{$('#refLinkStatus').textContent='Sin Firebase: las referencias no se enlazan entre alumnos.';}
}
async function ensureStudentFirebaseSession(){
 if(!firebaseEnabled)throw new Error('Firebase no está configurado.');
 const f=await getFirebase();if(!f)throw new Error('Firebase no está disponible.');
 await f.auth.authStateReady();
 const user=f.auth.currentUser;
 if(!user)throw new Error('Tu sesión de alumno terminó. Inicia sesión desde la portada para continuar.');
 if(storedAuthUid&&user.uid!==storedAuthUid)throw new Error('Firebase tiene otra cuenta activa en esta pestaña. Vuelve a entrar como alumno desde la portada.');
 if(user.providerData?.some(p=>p.providerId==='google.com'))throw new Error('Esta pestaña tiene una cuenta de profesor. Entra con la cuenta de alumno para invertir de forma de práctica.');
 if(sessionReady&&session.mode==='cloud'&&session.uid===user.uid)return session;
 session=await studentStart(profile);
 if(session.mode!=='cloud')throw new Error('No se pudo establecer la sesión de Firebase.');
 sessionReady=true;connectionFailure=null;void syncEarningsSummary(true);
 $('#syncStatus').textContent='Actividad conectada';$('#refCode').textContent=classroomCode(session.uid);
 await attachStudentListeners();await flush();
 return session;
}
(async()=>{
 try{
  await ensureStudentFirebaseSession();
  record('entry','Entró al panel');await flush();
  if(planQuery&&plans[planQuery]){
   setView('resumen');showChosenPlanBanner();
   history.replaceState(null,'',location.pathname);
  }
 }catch(e){
  console.error('No se pudo iniciar la sesión del alumno',e);
  connectionFailure=e;sessionReady=false;
  $('#syncStatus').textContent=explainFirebaseIssue(e);
  $('#refLinkStatus').textContent='La sesión de Firebase necesita revisión. Puedes iniciar sesión nuevamente desde la portada.';
 }
})();
window.addEventListener('focus',render);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)render();});
window.setInterval(render,60000);
window.addEventListener('pagehide',()=>{unsubscribe();unsubscribeRewards();unsubscribeCredits();unsubscribeWithdrawals();unsubscribePlanRequests();});
