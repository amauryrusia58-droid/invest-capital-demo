import {studentStart,logStudent,watchStage,firebaseEnabled,getFirebase,classroomCode,linkClassroomMember,getClassroomLink,recordClassroomContribution,watchClassroomRewards,requestVirtualCredit,watchVirtualCreditRequests,requestVirtualWithdrawal,watchVirtualWithdrawalRequests,requestVirtualPlanActivation,watchVirtualPlanRequests} from './backend.js?v=84';
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
 $('#selectedPlanTitle').textContent=`${name} · ${money(p.min)} en USDT ficticios`;
 const active=account.positions.some(x=>x.plan===name&&remainingPrincipal(x)>0);
 const pending=planActivationRequests.find(x=>x.plan===name&&x.status==='pending')||(planSubmitId?{plan:name,status:'pending'}:null);
 const rejected=planActivationRequests.filter(x=>x.plan===name&&x.status==='rejected').length>0;
 if(active){message.textContent='Este plan está activado en tu cartera de práctica. El importe está asignado únicamente a este plan.';btn.textContent='Plan activo';btn.disabled=true;btn.onclick=null;return;}
 if(pending){message.textContent='Tu simulación de envío está pendiente de revisión. No se ha acreditado saldo libre ni activado otro plan.';btn.textContent='Pendiente de revisión';btn.disabled=true;btn.onclick=null;return;}
 message.textContent=`Para activar este plan debes invertir ${money(p.min)} ficticios mediante la cartera de práctica USDT. No se envía dinero real.`+(rejected?' La última solicitud fue rechazada; puedes repetir el ejercicio.':'');
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
function elapsedDays(when){return calendarElapsed(Number(when));}
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
function positionProfit(pos){return Math.max(0,num(projected(pos.amount,pos.plan,elapsedDays(legacyStart(pos)),pos.rate).profit-(Number(pos.paidProfit)||0)));}
function remainingPrincipal(p){return Math.max(0,num(p.amount-(Number(p.principalPaid)||0)));}
function planMatured(p){return elapsedDays(legacyStart(p))>=plans[p.plan].weeks*7;}

let account={cash:0,positions:[],ledger:[],seq:0,withdrawalAnchor:0,lastWithdrawalCycle:-1,referrals:[],referralCreditedIds:{},approvedRequestIds:{},activatedPlanRequestIds:{},contributionQueue:[],reviewedWithdrawalIds:{},pendingWithdrawalRequestId:""};
try{
  const raw=JSON.parse(localStorage.getItem(STORE)||'null');
  if(raw&&Number.isFinite(raw.cash)&&Array.isArray(raw.positions)&&Array.isArray(raw.ledger)){
    account={cash:Math.max(0,num(raw.cash)),positions:raw.positions.filter(p=>plans[p.plan]&&Number.isFinite(p.amount)&&p.amount>0).slice(0,60).map(p=>({...p,paidProfit:Math.max(0,num(p.paidProfit||0)),principalPaid:Math.min(p.amount,Math.max(0,num(p.principalPaid||0)))})),ledger:raw.ledger.filter(r=>typeof r.name==='string'&&Number.isFinite(r.amount)).slice(0,100),seq:Number(raw.seq)||0,withdrawalAnchor:Number(raw.withdrawalAnchor)||0,lastWithdrawalCycle:Number.isInteger(raw.lastWithdrawalCycle)?raw.lastWithdrawalCycle:-1,referrals:Array.isArray(raw.referrals)?raw.referrals.filter(r=>[1,2,3].includes(r.level)&&Number.isFinite(r.amount)&&Number.isFinite(r.commission)).slice(0,100):[],referralCreditedIds:raw.referralCreditedIds&&typeof raw.referralCreditedIds==='object'&&!Array.isArray(raw.referralCreditedIds)?raw.referralCreditedIds:{},approvedRequestIds:raw.approvedRequestIds&&typeof raw.approvedRequestIds==='object'&&!Array.isArray(raw.approvedRequestIds)?raw.approvedRequestIds:{},activatedPlanRequestIds:raw.activatedPlanRequestIds&&typeof raw.activatedPlanRequestIds==='object'&&!Array.isArray(raw.activatedPlanRequestIds)?raw.activatedPlanRequestIds:{},reviewedWithdrawalIds:raw.reviewedWithdrawalIds&&typeof raw.reviewedWithdrawalIds==='object'&&!Array.isArray(raw.reviewedWithdrawalIds)?raw.reviewedWithdrawalIds:{},pendingWithdrawalRequestId:typeof raw.pendingWithdrawalRequestId==='string'?raw.pendingWithdrawalRequestId:"",contributionQueue:Array.isArray(raw.contributionQueue)?raw.contributionQueue.filter(p=>Number.isFinite(p.amount)&&p.amount>=1&&typeof p.reference==='string').slice(0,100):[]};
  }
}catch{}
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
function setView(v){if(!titles[v])return;view=v;$$('.workspace-section').forEach(x=>x.classList.toggle('active',x.dataset.section===v));$$('.side-link').forEach(x=>{x.classList.toggle('active',x.dataset.view===v);x.setAttribute('aria-current',x.dataset.view===v?'page':'false');});$('#viewTitle').textContent=titles[v][0];$('#viewSubtitle').textContent=titles[v][1];record('section','Abrió '+titles[v][0],v);window.scrollTo({top:0,behavior:'smooth'});}
function modal(title,html,callback=null,button='Confirmar'){modalTitle.textContent=title;modalContent.innerHTML=html;onConfirm=callback;confirmBtn.classList.toggle('hidden',!callback);confirmBtn.textContent=button;confirmBtn.disabled=false;overlay.classList.remove('hidden');}
function close(){overlay.classList.add('hidden');onConfirm=null;}
function err(text){const e=$('#modalError');if(e){e.textContent=text;e.hidden=false;}}
function tx(name,amount,status,kind){const seq=++account.seq;account.ledger.unshift({name,amount:num(amount),status,kind,ref:'IC-'+String(Date.now()).slice(-6)+String(seq).padStart(2,'0'),date:new Date().toLocaleDateString('es-ES')});account.ledger=account.ledger.slice(0,100);save();render();}
function principal(){return num(account.positions.reduce((s,p)=>s+remainingPrincipal(p),0));}
function gain(){return num(account.positions.reduce((s,p)=>s+positionProfit(p),0));}
function total(){return num(account.cash+principal()+gain());}
// V6 · Calendario de espera basado en la fecha de la primera aprobación y las últimas decisiones.
// Tras una decisión de retiro (aprobado o rechazado) se inicia un nuevo plazo de 30 días.
function lockAnchor(){if(account.withdrawalAnchor>0)return account.withdrawalAnchor;const starts=account.positions.map(legacyStart).filter(Number.isFinite);return starts.length?Math.min(...starts):0;}
function hasPendingWithdrawal(){return Boolean(account.pendingWithdrawalRequestId)||withdrawalRequests.some(x=>x.status==='pending');}
function withdrawalStatus(){
 const anchor=lockAnchor();
 if(!anchor)return {days:30,open:false,reason:'La primera aprobación de saldo virtual inicia el calendario de 30 días.'};
 const remaining=Math.max(0,30-calendarElapsed(anchor));
 return {days:remaining,open:remaining===0,reason:remaining>0?`Faltan ${remaining} día${remaining===1?'':'s'} para solicitar un retiro ficticio.`:'Ya puedes solicitar un retiro ficticio sujeto a aprobación.'};
}
function eligibleProfit(p){return elapsedDays(legacyStart(p))>=30?positionProfit(p):0;}
function withdrawable(){return num(account.cash+account.positions.reduce((s,p)=>s+eligibleProfit(p)+(planMatured(p)?remainingPrincipal(p):0),0));}
function renderWithdrawalStatus(){
 const w=withdrawalStatus();
 for(const id of ['actionWithdraw','withdrawInMovements'])$('#'+id).textContent='Retiro';
 $('#withdrawalCountdown').textContent=hasPendingWithdrawal()?'Retiro ficticio pendiente de revisión del administrador.':w.reason;
}

function ledgerRows(){const list=account.ledger;const tr=x=>{let tone=/pendiente|revisión|validación|proceso/i.test(x.status)?'warn':/suspend|rechaz/i.test(x.status)?'danger':'';return `<tr><td>${esc(x.name)}</td><td>${esc(x.ref)}</td><td>${x.amount>0?'+ ':''}${money(x.amount)}</td><td>${esc(x.date)}</td><td><span class="tag ${tone}">${esc(x.status)}</span></td></tr>`;};$('#fullRows').innerHTML=list.length?list.map(tr).join(''):'<tr><td colspan="5">Todavía no hay movimientos.</td></tr>';$('#recentRows').innerHTML=list.length?list.slice(0,4).map(x=>`<tr><td>${esc(x.name)}</td><td>${esc(x.date)}</td><td>${x.amount>0?'+ ':''}${money(x.amount)}</td><td><span class="tag ${/pendiente|revisión|validación|proceso/i.test(x.status)?'warn':''}">${esc(x.status)}</span></td></tr>`).join(''):'<tr><td colspan="4">Todavía no hay movimientos.</td></tr>';}
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
  const paid=Math.max(0,num(p.paidProfit||0));
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
 legend.textContent=`Línea continua: cálculo hasta hoy · Línea discontinua: proyección ficticia de ${chartProjectionDays} días · Próximo incremento estimado: ${money(dailyEstimated)} (mañana).`;
}
function render(){const invested=principal(),profit=gain(),value=total(),pos=account.positions.filter(x=>remainingPrincipal(x)>0||positionProfit(x)>0);
  renderWithdrawalStatus();
  $('#totalVal').textContent=money(value);$('#investedVal').textContent=money(invested);$('#gainVal').textContent=money(profit);$('#availableVal').textContent=money(account.cash);$('#totalDelta').textContent=account.ledger.length?`${account.ledger.length} movimientos registrados`:'Sin movimientos registrados';$('#activeCountVal').textContent=pos.length+' posiciones activas';$('#availabilityStatus').textContent=stage===3?'Retiros suspendidos':stage===2?'Retiros sujetos a validación':account.cash>0?'Saldo de práctica anterior · no activa planes':'Sin saldo libre';
  const notices=['','Actualización de resultados: las posiciones reflejan un nuevo periodo de rendimiento.','Comunicado operativo: los retiros están sujetos a validaciones adicionales.','Comunicado operativo: las solicitudes de retiro están temporalmente suspendidas.'];const note=$('#scenarioNotice');note.classList.toggle('hidden',!stage);note.classList.toggle('negative',stage>=2);note.textContent=notices[stage]||'';
  $('#onboardingNotice').classList.toggle('hidden',account.ledger.length>0);
  $('#portfolioTotalVal').textContent=money(invested+profit);$('#portfolioCountVal').textContent=String(pos.length);$('#portfolioInvestedVal').textContent=money(invested);$('#portfolioGainVal').textContent=money(profit);
  $('#positionRows').innerHTML=pos.length?pos.map(p=>`<tr><td>${esc(p.plan)}</td><td>${money(remainingPrincipal(p))}</td><td>${money(positionProfit(p))}</td><td>${Math.min(elapsedDays(legacyStart(p)),plans[p.plan].weeks*7)}</td><td>${esc(p.date)}</td><td><span class="tag">Activa</span></td></tr>`).join(''):'<tr><td colspan="6">Aún no tienes posiciones.</td></tr>';
  $('#assetRows').innerHTML=pos.length?pos.map(p=>`<div class="asset-row"><span class="asset-logo">◈</span><span><b>${esc(p.plan)}</b><small>USDT · DEMO</small></span><span class="asset-amount">${money(remainingPrincipal(p))}<small class="up">${positionProfit(p)>0?`+ ${money(positionProfit(p))}`:'Sin variación'}</small></span></div>`).join(''):'<p class="muted empty-state">No tienes activos asignados.</p>';
  drawPortfolioChart(pos,invested,profit);
  $('#supportStatus').textContent=stage===3?'Servicio limitado: solicitudes de retiro suspendidas.':stage===2?'Volumen elevado de consultas; tiempos de respuesta ampliados.':'Los canales de atención están operativos.';
  $('#refCount').textContent=String(account.referrals.length);$('#refCommission').textContent=money(account.referrals.reduce((sum,r)=>sum+r.commission,0));
  $('#refRows').innerHTML=account.referrals.length?account.referrals.slice(0,8).map(r=>`<tr><td>${esc(r.alias)}</td><td>Nivel ${r.level}</td><td>${money(r.amount)}</td><td>+${money(r.commission)}</td></tr>`).join(''):'<tr><td colspan="4">Todavía no hay operaciones de la red.</td></tr>';
  ledgerRows();
  renderWithdrawalRequests();
}
function setStage(x){stage=Math.min(3,Math.max(0,Number(x)||0));render();}
// V8.3 · Plan seleccionado → cartera ficticia → solicitud → aprobación → posición del plan.
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
  modal('Pendiente de revisión','<div class="notice">Ya tienes una activación de plan pendiente. Espera la decisión del profesor.</div>');return;
 }
 if(planActivationRequests.some(r=>r.status==='approved'&&r.plan===plan)){
  modal('Plan ya aprobado','<p>El profesor ya aprobó este plan de práctica. Comprueba su activación en tu cartera.</p>');return;
 }
 record('plan_view',`Seleccionó el plan ${plan} para practicar su activación`,'planes');
 modal('Cartera USDT ficticia · '+plan,`
  <div class="ic-demo-wallet" role="group" aria-label="Cartera de simulación sin transacciones reales">
   <div class="ic-wallet-head"><span>◈ INVEST CAPITAL</span><b>USDT · DEMO</b></div>
   <small>CUENTA DE DESTINO DEL EJERCICIO</small>
   <strong>CAR-PRÁCTICA-INVEST-CAPITAL</strong>
   <div class="ic-wallet-amount">${money(cfg.min)} <small>ficticios</small></div>
   <p>Plan a activar: <b>${esc(plan)}</b></p>
  </div>
  <p>Para activar <strong>${esc(plan)}</strong>, simula el envío de <strong>${money(cfg.min)} USDT</strong> a esta cartera de práctica.</p>
  <div class="modal-note"><strong>SIMULACIÓN EDUCATIVA.</strong> Esta cartera es únicamente un dibujo del ejercicio; no contiene dirección blockchain ni acepta depósitos. No envíes USDT auténticos.</div>
  <p id="modalError" class="form-error" hidden></p>
 `,async()=>{
  if(planSubmitBusy||planSubmitId||planActivationRequests.some(r=>r.status==='pending')){err('Ya existe una solicitud pendiente.');return;}
  planSubmitBusy=true;confirmBtn.disabled=true;
  try{
   await ensureStudentFirebaseSession();
   planSubmitId=await requestVirtualPlanActivation(session,plan,alias);
   record('plan_requested',`Solicitó activar ${plan} con ${cfg.min.toFixed(2)} USDT DEMO`,'planes');
   modal('Plan pendiente de revisión',`<div class="notice"><b>${esc(plan)} · ${money(cfg.min)} ficticios</b></div><p>El profesor recibió tu simulación de envío. El plan no estará activo hasta que lo apruebe.</p><p class="tiny">No se ha acreditado saldo libre ni transferido ninguna criptomoneda.</p>`);
  }catch(e){connectionFailure=e;showFirebaseIssue(e);confirmBtn.disabled=false;}
  finally{planSubmitBusy=false;showChosenPlanBanner();}
 },`Simular envío de ${money(cfg.min)}`);
}
function renderPlanActivationRequests(){
 const box=$('#planActivationBox');if(!box)return;box.replaceChildren();
 const h=document.createElement('h2');h.textContent='Activaciones de planes';box.append(h);
 const tip=document.createElement('p');tip.className='tiny';tip.textContent='Solicitudes de cartera ficticia (USDT DEMO). Solo una aprobación docente activa el plan elegido.';box.append(tip);
 if(!planActivationRequests.length){const p=document.createElement('p');p.className='muted';p.textContent='Aún no has solicitado activar ningún plan.';box.append(p);return;}
 const sorted=[...planActivationRequests].sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
 for(const r of sorted.slice(0,8)){
  const line=document.createElement('div');line.className='credit-request-row';
  const label=document.createElement('strong');label.textContent=`${r.plan} · ${money(r.amount)} DEMO`;
  const state=document.createElement('span');state.className='tag '+(r.status==='pending'?'warn':r.status==='rejected'?'danger':'');
  state.textContent=r.status==='approved'?'Aprobada · plan activado':r.status==='rejected'?'Rechazada':'Pendiente de revisión';
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
  if(!plan||amount!==plan.min)continue;
  // Cada ID aprobado se aplica una vez. El importe se convierte directamente en
  // posición del plan indicado y NUNCA pasa por account.cash.
  account.activatedPlanRequestIds[r.id]=true;
  const started=timestampMs(r.decisionAt)||timestampMs(r.createdAt)||Date.now();
  account.positions.push({plan:r.plan,amount,rate:plan.rate,date:new Date(started).toLocaleDateString('es-ES'),openedAt:started,paidProfit:0,principalPaid:0,activationRequestId:r.id});
  // Mantiene las actividades del ejercicio de referidos, con el mismo ID único.
  pendingContributions.push({amount,reference:r.id.slice(0,35)});
  if(!lockAnchor())account.withdrawalAnchor=started;
  tx('Activación ficticia de plan '+r.plan,amount,'Activa','invest');
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
 modal('Seleccionar plan para la cartera ficticia',`<p>Elige el plan que deseas activar. Cada plan requiere una solicitud propia y la aprobación del profesor.</p><div>${entries}</div><p class="tiny">Todo el proceso es de práctica; no se envían criptomonedas.</p>`);
 modalContent.querySelectorAll('[data-choose-wallet-plan]').forEach(b=>b.addEventListener('click',()=>{
  const p=b.dataset.chooseWalletPlan;rememberChosenPlan(p);showChosenPlanBanner();openPlanWallet(p);
 }));
}
// Nueva inversión de clase: solicitud de crédito virtual, SIN saldo anticipado.
function deposit(presetAmount=100){
 if(creditSubmissionInFlight || justSubmittedCreditId || creditRequests.some(r=>r.status==='pending')){
  modal('Solicitud pendiente','<div class="notice"><strong>Ya tienes una solicitud de crédito virtual pendiente.</strong></div><p>Espera la decisión del profesor; no necesitas enviar otra solicitud por el mismo plan.</p>');
  return;
 }
 const startAmount=(typeof presetAmount==='number' && Number.isFinite(presetAmount) && presetAmount>=1 && presetAmount<=100000)?presetAmount:100;
 record('deposit_open','Abrió la solicitud de crédito virtual de prueba');
 modal('Solicitar inversión simulada',`
 <div class="modal-note"><strong>SIMULACIÓN EDUCATIVA</strong> · No envíes dinero ni criptomonedas. El profesor revisará únicamente una cantidad ficticia.</div>
 <label class="field-label" for="amountValue">Cantidad virtual (USDT de práctica)</label>
 <input class="plain-input" id="amountValue" type="number" min="1" max="100000" step="0.01" value="${startAmount}" inputmode="decimal">
 <p id="modalError" class="form-error" hidden></p>
 <p class="tiny">Hasta la aprobación del profesor, el importe no se acredita en el saldo disponible.</p>
 `,async()=>{
  const raw=$('#amountValue').value,n=num(raw);
  if(!raw.trim()||!Number.isFinite(Number(raw))||n<1||n>100000){err('Introduce una cantidad ficticia entre 1 y 100.000.');return;}
  if(!sessionReady||session.mode!=='cloud'){err('No hay conexión con Firebase. No se ha creado ninguna solicitud ni acreditado saldo.');return;}
  if(creditSubmissionInFlight||justSubmittedCreditId||creditRequests.some(r=>r.status==='pending')){err('Ya existe una solicitud pendiente de revisión.');return;}
  creditSubmissionInFlight=true;confirmBtn.disabled=true;
  try{
   const requestId=await requestVirtualCredit(session,n,alias);
   justSubmittedCreditId=requestId;
   record('credit_requested',`Solicitó revisión de ${n.toFixed(2)} USDT virtuales`);
   modal('Pendiente de revisión',`<div class="notice"><strong>${money(n)} ficticios · Pendiente de revisión</strong></div><p>Tu solicitud se ha enviado al panel del profesor. El saldo se acreditará únicamente si la aprueba.</p><p class="tiny">Consulta su estado en el resumen de cuenta. No se realiza ninguna transferencia.</p>`);
  }catch(e){err('No se pudo registrar la solicitud: '+e.message);confirmBtn.disabled=false;}
  finally{creditSubmissionInFlight=false;showChosenPlanBanner();}
 },'Enviar solicitud');
}
let creditRequests=[],withdrawalRequests=[],creditSubmissionInFlight=false,justSubmittedCreditId='';
function renderCreditRequests(){
 const box=$('#creditRequestBox');if(!box)return;
 box.replaceChildren();
 const rows=[...creditRequests].sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
 const pending=rows.filter(r=>r.status==='pending');
 const heading=document.createElement('h2');heading.textContent=`Solicitudes de inversión virtual ${pending.length?'· '+pending.length+' pendiente(s)':''}`;box.append(heading);
 const note=document.createElement('p');note.className='tiny';note.textContent='Importes ficticios para el aula. Ninguna solicitud aumenta tu saldo antes de la aprobación del profesor.';box.append(note);
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
 summary.textContent=`Aprobaciones registradas en Firebase: ${approved.length} · Capital ficticio aprobado: ${money(approvedAmount)}. El saldo de la cuenta también puede incluir movimientos anteriores, asignaciones y bonificaciones simuladas.`;
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
  record('deposit_confirmed',`Se acreditaron ${n.toFixed(2)} USDT ficticios tras aprobación docente`);
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
function planSelect(plan){choosePlan(plan);openPlanWallet(plan);}

function renderWithdrawalRequests(){
 const box=$('#withdrawRequestBox');if(!box)return;
 box.replaceChildren();
 const ordered=[...withdrawalRequests].sort((a,b)=>(timestampMs(b.createdAt)||0)-(timestampMs(a.createdAt)||0));
 const pending=ordered.filter(r=>r.status==='pending');
 const heading=document.createElement('h2');heading.textContent='Solicitudes de retiro ficticio'+(pending.length?` · ${pending.length} pendiente(s)`:'');box.append(heading);
 box.append(Object.assign(document.createElement('p'),{className:'tiny',textContent:'Simulación educativa: ninguna aprobación transfiere dinero ni criptomonedas.'}));
 if(!ordered.length){box.append(Object.assign(document.createElement('p'),{className:'muted',textContent:'Todavía no hay solicitudes de retiro.'}));return;}
 for(const r of ordered.slice(0,8)){
  const row=document.createElement('div');row.className='credit-request-row';
  const amount=document.createElement('strong');amount.textContent=money(r.amount)+' · virtual';
  const state=document.createElement('span');state.className='tag '+(r.status==='pending'?'warn':r.status==='rejected'?'danger':'');
  state.textContent=r.status==='approved'?'Aprobada · saldo virtual descontado':r.status==='rejected'?'Rechazada':'Pendiente de revisión';
  row.append(amount,state);box.append(row);
 }
}
function consumeApprovedWithdrawal(amount){
 if(withdrawable()+.001<amount)return false;
 let left=amount;
 const useCash=Math.min(left,account.cash);account.cash=num(account.cash-useCash);left=num(left-useCash);
 for(const p of account.positions){if(left<=0)break;const use=Math.min(left,eligibleProfit(p));p.paidProfit=num((p.paidProfit||0)+use);left=num(left-use);}
 for(const p of account.positions){if(left<=0)break;if(!planMatured(p))continue;const use=Math.min(left,remainingPrincipal(p));p.principalPaid=num((p.principalPaid||0)+use);left=num(left-use);}
 return left<=.001;
}
function onWithdrawalRequests(rows){
 withdrawalRequests=rows;
 let changed=false;
 for(const r of [...rows].sort((a,b)=>(timestampMs(a.decisionAt)||0)-(timestampMs(b.decisionAt)||0))){
  if(!['approved','rejected'].includes(r.status)||account.reviewedWithdrawalIds[r.id])continue;
  const when=timestampMs(r.decisionAt)||Date.now();
  if(r.status==='approved'){
   const amount=num(r.amount);
   if(!Number.isFinite(amount)||amount<1||!consumeApprovedWithdrawal(amount)){
    $('#syncStatus').textContent='Retiro aprobado: saldo local insuficiente para descontarlo. Revisa la sesión.';
    continue;
   }
   account.reviewedWithdrawalIds[r.id]='approved';
   account.withdrawalAnchor=when;
   account.pendingWithdrawalRequestId='';
   tx('Retiro ficticio aprobado por el profesor',-amount,'Aprobado','withdraw');
   record('withdraw_approved',`Retiro virtual aprobado por ${amount.toFixed(2)} USDT`,'movimientos');
  }else{
   account.reviewedWithdrawalIds[r.id]='rejected';
   account.withdrawalAnchor=when;
   account.pendingWithdrawalRequestId='';
   tx('Retiro ficticio rechazado por el profesor',0,'Rechazado','withdraw');
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
 record('withdraw_open','Consultó retiro ficticio','movimientos');
 const w=withdrawalStatus();
 if(!lockAnchor()){modal('Retiro · simulación',`<div class="notice">${esc(w.reason)}</div>`);return;}
 if(hasPendingWithdrawal()){modal('Pendiente de revisión','<div class="notice">Ya tienes una solicitud de retiro ficticio pendiente de decisión. Cuando el profesor responda aparecerá aquí el resultado.</div>');return;}
 if(stage===3){modal('Escenario: retiros suspendidos','<div class="notice negative">La simulación está en un escenario de retiros suspendidos.</div>');return;}
 if(!w.open){record('withdraw_locked',`Consultó calendario: faltan ${w.days} días`,'movimientos');modal('Retiro · calendario',`<div class="withdraw-count"><b>${w.days}</b><span>día${w.days===1?'':'s'} para solicitar</span></div><p>${esc(w.reason)}</p><p class="tiny">El conteo avanza por fechas del calendario, aunque no hayan pasado 24 horas completas. Los retiros son exclusivamente ficticios.</p>`);return;}
 const cap=withdrawable();
 if(cap<1){modal('Retiro disponible','<div class="notice">Ya cumpliste los 30 días, pero no hay saldo virtual elegible para solicitar. Los rendimientos requieren 30 días de posición y el principal queda sujeto al plazo del plan.</div>');return;}
 modal('Solicitar retiro ficticio',`<div class="modal-note"><strong>SIMULACIÓN EDUCATIVA</strong> · No se realiza ningún pago.</div><p>Saldo virtual elegible: <strong>${money(cap)}</strong></p><label class="field-label" for="amountValue">Cantidad ficticia (USDT)</label><input id="amountValue" class="plain-input" type="number" step="0.01" min="1" max="${cap}" value="${Math.min(100,cap)}"><p id="modalError" class="form-error" hidden></p><p class="tiny">La solicitud quedará pendiente en el panel del profesor. No descontaremos el saldo virtual hasta que sea aprobada.</p>`,async()=>{
  const raw=$('#amountValue').value,n=num(Number(raw));
  if(!raw.trim()||!Number.isFinite(Number(raw))||n<1||n>withdrawable()){err('Introduce una cantidad ficticia entre 1 y el saldo elegible.');return;}
  if(!withdrawalStatus().open||hasPendingWithdrawal()){err('La solicitud no está disponible en este momento.');return;}
  if(!sessionReady||session.mode!=='cloud'){err('Sin conexión Firebase: no se ha creado ninguna solicitud.');return;}
  confirmBtn.disabled=true;
  try{
   const id=await requestVirtualWithdrawal(session,n,alias);
   account.pendingWithdrawalRequestId=id;save();
   record('withdraw_attempt',`Solicitó retirar ${n.toFixed(2)} USDT ficticios`,'movimientos');
   render();
   modal('Retiro pendiente',`<div class="notice"><strong>${money(n)} ficticios · Pendiente de revisión</strong></div><p>El profesor recibió la solicitud. Solo su aprobación descontará el importe del saldo virtual; si la rechaza verás «Rechazada» y se iniciará un nuevo plazo de 30 días.</p>`);
  }catch(e){err('No se pudo enviar la solicitud: '+e.message);confirmBtn.disabled=false;}
 },'Enviar solicitud de retiro');
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
  record('chart',`Consultó proyección ficticia de ${chartProjectionDays} días`);
 });
});
$$('[data-plan]').forEach(b=>b.addEventListener('click',()=>planSelect(b.dataset.plan)));
$$('[data-document]').forEach(b=>b.addEventListener('click',()=>{const name=b.dataset.document;record('document','Consultó '+name,'documentos');modal(name,`<p>${esc(docs[name]||'Documento no disponible.')}</p>`);}));
$('#sideInvest').addEventListener('click',startPlanInvestment);$('#actionDeposit').addEventListener('click',startPlanInvestment);$('#startDeposit').addEventListener('click',startPlanInvestment);$('#actionWithdraw').addEventListener('click',withdrawal);$('#withdrawInMovements').addEventListener('click',withdrawal);
$('#newReferralActivity').addEventListener('click',referralActivity);
$('#copyRef').addEventListener('click',async()=>{record('referral','Consultó identificador del programa','referidos');try{await navigator.clipboard.writeText($('#refCode').textContent.trim());modal('Identificador de asociado','Copiado al portapapeles.');}catch{modal('Identificador de asociado',esc($('#refCode').textContent));}});
$('#sendSupport').addEventListener('click',()=>{const r=$('#supportSubject').value,m=$('#supportText').value.trim();if(m.length<5){modal('Falta información','Escribe una consulta de al menos 5 caracteres.');return;}record('support','Envió consulta: '+r,'soporte');$('#supportText').value='';tx('Consulta · '+r,0,'Recibida','support');modal('Consulta registrada','Tu solicitud de atención figura en el historial.');});
$('#closeModal').addEventListener('click',close);overlay.addEventListener('click',e=>{if(e.target===overlay)close();});window.addEventListener('keydown',e=>{if(e.key==='Escape')close();});confirmBtn.addEventListener('click',()=>onConfirm?.());
const exit=document.createElement('button');exit.className='btn btn-soft';exit.textContent='Cerrar sesión';exit.style.marginTop='12px';exit.addEventListener('click',async()=>{record('exit','Cerró sesión');await flush();try{const f=await getFirebase();if(f?.auth.currentUser)await f.Auth.signOut(f.auth);}catch{}localStorage.removeItem('ic_v3_alias');localStorage.removeItem('ic_v3_profile');localStorage.removeItem('ic_v3_consent');localStorage.removeItem('ic_v3_auth_uid');location.replace('index.html?login=1');});$('.side-foot').append(exit);
$('#userAlias').textContent=alias;$('#refCode').textContent='Conectando…';render();renderCreditRequests();renderWithdrawalRequests();renderPlanActivationRequests();showChosenPlanBanner();
async function attachStudentListeners(){
 unsubscribe();unsubscribeRewards();unsubscribeCredits();unsubscribeWithdrawals();unsubscribePlanRequests();
 unsubscribe=watchStage(session,setStage,()=>{$('#syncStatus').textContent='No se pudo leer el escenario';});
 if(session.mode==='cloud'){
  try{await applyClassroomCode(profile.referralCode||'');}
  catch(e){$('#refLinkStatus').textContent='El código indicado no pudo vincularse: '+e.message+' Puedes corregirlo aquí.';}
  unsubscribeCredits=watchVirtualCreditRequests(session,onCreditRequests,e=>{console.error('Error leyendo solicitudes',e);const box=$('#creditRequestBox');if(box)box.textContent='No se pudieron consultar las solicitudes: '+e.message;});
  unsubscribePlanRequests=watchVirtualPlanRequests(session,onPlanActivationRequests,e=>{console.error('Error leyendo activaciones',e);const box=$('#planActivationBox');if(box)box.textContent='No se pudieron consultar activaciones: '+e.message;});
  unsubscribeWithdrawals=watchVirtualWithdrawalRequests(session,onWithdrawalRequests,e=>{console.error('Error leyendo retiros virtuales',e);$('#withdrawRequestBox').textContent='No se pudieron consultar solicitudes de retiro: '+e.message;});
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
 if(user.providerData?.some(p=>p.providerId==='google.com'))throw new Error('Esta pestaña tiene una cuenta de profesor. Entra con la cuenta de alumno para invertir de forma ficticia.');
 if(sessionReady&&session.mode==='cloud'&&session.uid===user.uid)return session;
 session=await studentStart(profile);
 if(session.mode!=='cloud')throw new Error('No se pudo establecer la sesión de Firebase.');
 sessionReady=true;connectionFailure=null;
 $('#syncStatus').textContent='Actividad conectada';$('#refCode').textContent=classroomCode(session.uid);
 await attachStudentListeners();await flush();
 return session;
}
(async()=>{
 try{
  await ensureStudentFirebaseSession();
  record('entry','Entró al panel');await flush();
  if(planQuery&&plans[planQuery]){
   setView('planes');showChosenPlanBanner();
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
