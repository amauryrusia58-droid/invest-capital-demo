import {studentStart,logStudent,watchStage,firebaseEnabled,getFirebase} from './backend.js';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const alias=(localStorage.getItem('ic_v3_alias')||'').trim();
let profile={name:alias,email:'',group:''};
try{let p=JSON.parse(localStorage.getItem('ic_v3_profile')||'null');if(p?.name===alias)profile={name:alias,email:String(p.email||''),group:String(p.group||'')};}catch{}
if(localStorage.getItem('ic_v3_consent')!=='yes'||!alias)location.replace('index.html');
const titles={resumen:['Resumen de cuenta','Estado general de tu cartera'],planes:['Planes de inversión','Condiciones y oportunidades de gestión'],calculadora:['Calculadora de rendimientos','Proyección de capital según plan y días'],cartera:['Mi cartera','Posiciones y distribución de activos'],movimientos:['Historial de movimientos','Operaciones registradas en tu cuenta'],referidos:['Programa de asociados','Información de tu red de asociados'],documentos:['Centro documental','Información corporativa y condiciones'],soporte:['Centro de atención','Gestión de solicitudes y consultas']};
const plans={Essential:{min:100,rate:.02,weeks:8},Advanced:{min:300,rate:.035,weeks:12},Prime:{min:500,rate:.05,weeks:16},"Magnate Supremo":{min:1000,rate:.07,weeks:20}};
const STORE='ic_v34_'+encodeURIComponent((alias+'|'+profile.group).toLowerCase());
const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=n=>Math.round((Number(n)||0)*100)/100;
const MS_DAY=86400000;
// Por día natural transcurrido: tasa semanal proporcional, interés simple,
// limitado al plazo del plan. No hay precios, tokens ni rendimientos reales.
function elapsedDays(when){const t=Number(when);return Number.isFinite(t)&&t>0?Math.max(0,Math.floor((Date.now()-t)/MS_DAY)):0;}
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
function positionProfit(pos){return projected(pos.amount,pos.plan,elapsedDays(legacyStart(pos)),pos.rate).profit;}

let account={cash:0,positions:[],ledger:[],seq:0};
try{
  const raw=JSON.parse(localStorage.getItem(STORE)||'null');
  if(raw&&Number.isFinite(raw.cash)&&Array.isArray(raw.positions)&&Array.isArray(raw.ledger)){
    account={cash:Math.max(0,num(raw.cash)),positions:raw.positions.filter(p=>plans[p.plan]&&Number.isFinite(p.amount)&&p.amount>0).slice(0,60),ledger:raw.ledger.filter(r=>typeof r.name==='string'&&Number.isFinite(r.amount)).slice(0,100),seq:Number(raw.seq)||0};
  }
}catch{}
let view='resumen',stage=0,session={mode:'local'},sessionReady=false,sending=false,unsubscribe=()=>{},onConfirm=null;
const pending=[], overlay=$('#actionModal'), modalTitle=$('#modalTitle'), modalContent=$('#modalContent'),confirmBtn=$('#confirmModal');
function save(){localStorage.setItem(STORE,JSON.stringify(account));}
function record(type,label,which=view){if(!firebaseEnabled)return;pending.push({type,label,view:which});void flush();}
async function flush(){if(!sessionReady||sending||session.mode!=='cloud')return;sending=true;try{while(pending.length){const a=pending[0];await logStudent(session,a.type,a.label,a.view);pending.shift();}$('#syncStatus').textContent='Actividad conectada';}catch(e){console.warn('Acciones pendientes de conexión',e);$('#syncStatus').textContent='Sincronización pendiente';}finally{sending=false;}}
function setView(v){if(!titles[v])return;view=v;$$('.workspace-section').forEach(x=>x.classList.toggle('active',x.dataset.section===v));$$('.side-link').forEach(x=>{x.classList.toggle('active',x.dataset.view===v);x.setAttribute('aria-current',x.dataset.view===v?'page':'false');});$('#viewTitle').textContent=titles[v][0];$('#viewSubtitle').textContent=titles[v][1];record('section','Abrió '+titles[v][0],v);window.scrollTo({top:0,behavior:'smooth'});}
function modal(title,html,callback=null,button='Confirmar'){modalTitle.textContent=title;modalContent.innerHTML=html;onConfirm=callback;confirmBtn.classList.toggle('hidden',!callback);confirmBtn.textContent=button;confirmBtn.disabled=false;overlay.classList.remove('hidden');}
function close(){overlay.classList.add('hidden');onConfirm=null;}
function err(text){const e=$('#modalError');if(e){e.textContent=text;e.hidden=false;}}
function tx(name,amount,status,kind){const seq=++account.seq;account.ledger.unshift({name,amount:num(amount),status,kind,ref:'IC-'+String(Date.now()).slice(-6)+String(seq).padStart(2,'0'),date:new Date().toLocaleDateString('es-ES')});account.ledger=account.ledger.slice(0,100);save();render();}
function principal(){return num(account.positions.reduce((s,p)=>s+p.amount,0));}
function gain(){return num(account.positions.reduce((s,p)=>s+positionProfit(p),0));}
function total(){return num(account.cash+principal()+gain());}
function ledgerRows(){const list=account.ledger;const tr=x=>{let tone=/pendiente|revisión|validación|proceso/i.test(x.status)?'warn':/suspend|rechaz/i.test(x.status)?'danger':'';return `<tr><td>${esc(x.name)}</td><td>${esc(x.ref)}</td><td>${x.amount>0?'+ ':''}${money(x.amount)}</td><td>${esc(x.date)}</td><td><span class="tag ${tone}">${esc(x.status)}</span></td></tr>`;};$('#fullRows').innerHTML=list.length?list.map(tr).join(''):'<tr><td colspan="5">Todavía no hay movimientos.</td></tr>';$('#recentRows').innerHTML=list.length?list.slice(0,4).map(x=>`<tr><td>${esc(x.name)}</td><td>${esc(x.date)}</td><td>${x.amount>0?'+ ':''}${money(x.amount)}</td><td><span class="tag ${/pendiente|revisión|validación|proceso/i.test(x.status)?'warn':''}">${esc(x.status)}</span></td></tr>`).join(''):'<tr><td colspan="4">Todavía no hay movimientos.</td></tr>';}
function render(){const invested=principal(),profit=gain(),value=total(),pos=account.positions.filter(x=>x.amount>0);
  $('#totalVal').textContent=money(value);$('#investedVal').textContent=money(invested);$('#gainVal').textContent=money(profit);$('#availableVal').textContent=money(account.cash);$('#totalDelta').textContent=account.ledger.length?`${account.ledger.length} movimientos registrados`:'Sin movimientos registrados';$('#activeCountVal').textContent=pos.length+' posiciones activas';$('#availabilityStatus').textContent=stage===3?'Retiros suspendidos':stage===2?'Retiros sujetos a validación':account.cash>0?'Disponible para invertir':'Sin saldo libre';
  const notices=['','Actualización de resultados: las posiciones reflejan un nuevo periodo de rendimiento.','Comunicado operativo: los retiros están sujetos a validaciones adicionales.','Comunicado operativo: las solicitudes de retiro están temporalmente suspendidas.'];const note=$('#scenarioNotice');note.classList.toggle('hidden',!stage);note.classList.toggle('negative',stage>=2);note.textContent=notices[stage]||'';
  $('#onboardingNotice').classList.toggle('hidden',account.ledger.length>0);
  $('#portfolioTotalVal').textContent=money(invested+profit);$('#portfolioCountVal').textContent=String(pos.length);$('#portfolioInvestedVal').textContent=money(invested);$('#portfolioGainVal').textContent=money(profit);
  $('#positionRows').innerHTML=pos.length?pos.map(p=>`<tr><td>${esc(p.plan)}</td><td>${money(p.amount)}</td><td>${money(positionProfit(p))}</td><td>${Math.min(elapsedDays(legacyStart(p)),plans[p.plan].weeks*7)}</td><td>${esc(p.date)}</td><td><span class="tag">Activa</span></td></tr>`).join(''):'<tr><td colspan="6">Aún no tienes posiciones.</td></tr>';
  $('#assetRows').innerHTML=pos.length?pos.map(p=>`<div class="asset-row"><span class="asset-logo">◈</span><span><b>${esc(p.plan)}</b><small>USDT · BEP20</small></span><span class="asset-amount">${money(p.amount)}<small class="up">${positionProfit(p)>0?`+ ${money(positionProfit(p))}`:'Sin variación'}</small></span></div>`).join(''):'<p class="muted empty-state">No tienes activos asignados.</p>';
  $('#chartCaption').textContent=pos.length?`Capital asignado: ${money(invested)} · Rendimiento calculado hasta hoy: ${money(profit)}`:'Sin operaciones: la gráfica comenzará cuando abras una posición.';
  const maxDays=Math.max(1,...pos.map(p=>elapsedDays(legacyStart(p))));
  const values=Array.from({length:9},(_,i)=>{const at=Math.round(maxDays*i/8);return num(pos.reduce((s,p)=>s+p.amount+projected(p.amount,p.plan,Math.max(0,at-(maxDays-elapsedDays(legacyStart(p)))),p.rate).profit,0));});
  const low=Math.min(...values),high=Math.max(...values),span=Math.max(1,high-low);
  const pts=values.map((v,i)=>`${Math.round(i*87.5)},${pos.length?Math.round(191-118*(v-low)/span):210}`).join(' ');
  $('#chartLine').setAttribute('points',pts);$('#chartArea').setAttribute('d','M'+pts.split(' ').map(t=>t.replace(',',' ')).join(' L')+' L700 230 L0 230 Z');
  $('#supportStatus').textContent=stage===3?'Servicio limitado: solicitudes de retiro suspendidas.':stage===2?'Volumen elevado de consultas; tiempos de respuesta ampliados.':'Los canales de atención están operativos.';
  ledgerRows();
}
function setStage(x){stage=Math.min(3,Math.max(0,Number(x)||0));render();}
function deposit(){record('deposit_open','Abrió el formulario de aporte USDT BEP20');modal('Depósito de USDT · BEP20',`
 <div class="wallet-card"><span class="wallet-network">Activo: <strong>USDT</strong> &nbsp; · &nbsp; Red: <strong>BNB Smart Chain (BEP20)</strong></span><small>Referencia de cartera</small><div class="wallet-reference">IC-DEMO-BEP20-001</div><small>Identificador de aula no válido para recibir criptomonedas.</small></div>
 <label class="field-label" for="amountValue">Importe del aporte (USDT)</label><input class="plain-input" id="amountValue" type="number" min="1" max="100000" step="0.01" value="100" inputmode="decimal">
 <p id="modalError" class="form-error" hidden></p><p class="tiny">Este formulario no procesa transferencias ni verifica operaciones en blockchain.</p>`,()=>{const n=num($('#amountValue').value);if(!Number.isFinite(n)||n<1||n>100000||!Number.isFinite(Number($('#amountValue').value))){err('Introduce una cantidad entre 1 y 100.000 USDT.');return;}account.cash=num(account.cash+n);tx('Aporte USDT · BEP20',n,'Registrado','deposit');record('deposit_confirmed',`Registró aporte virtual de ${n.toFixed(2)} USDT por BEP20`);modal('Aporte registrado',`<p>Se registró en tu cuenta un aporte de <strong>${money(n)}</strong>.</p><div class="modal-note">No se ha efectuado una transferencia blockchain. Puedes asignar este saldo a un plan desde la sección «Planes».</div>`,()=>{close();setView('planes');},'Elegir un plan');},'Registrar aporte');}
function planSelect(plan){const p=plans[plan];if(!p)return;record('plan_view','Consultó plan '+plan,'planes');modal('Seleccionar plan · '+plan,`<p>Rendimiento semanal anunciado: <strong>${(p.rate*100).toLocaleString('es-ES')} %</strong>. Capital mínimo: <strong>${money(p.min)}</strong>.</p><p>Saldo disponible: <strong>${money(account.cash)}</strong></p><label for="amountValue" class="field-label">Capital que deseas asignar (USDT)</label><input id="amountValue" type="number" class="plain-input" min="${p.min}" max="${Math.max(p.min,account.cash)}" step="0.01" value="${Math.max(p.min,Math.min(account.cash,p.min))}"><p id="modalError" class="form-error" hidden></p>${account.cash<p.min?'<p class="modal-note">No tienes saldo suficiente. Primero debes registrar un aporte.</p>':''}`,()=>{const input=Number($('#amountValue').value),n=num(input);if(!Number.isFinite(input)||n<p.min||n>account.cash){err('Introduce un importe válido dentro de tu saldo disponible.');return;}account.cash=num(account.cash-n);account.positions.push({plan,amount:n,rate:p.rate,date:new Date().toLocaleDateString('es-ES'),openedAt:Date.now()});tx('Asignación a plan '+plan,-n,'Activa','invest');record('plan_assign',`Asignó ${n.toFixed(2)} USDT al plan ${plan}`,'planes');modal('Posición abierta',`<p>Has asignado <strong>${money(n)}</strong> al plan ${esc(plan)}.</p><p>La operación ya aparece en tu cartera.</p>`,()=>{close();setView('resumen');},'Ver mi cartera');},'Asignar capital');}
function withdrawal(){record('withdraw_open','Abrió solicitudes de retiro');const cap=num(account.cash+principal());const blocked=stage===3;
 modal('Solicitar retiro',`<p>Saldo potencialmente rescatable: <strong>${money(cap)}</strong></p><label class="field-label" for="amountValue">Importe (USDT)</label><input id="amountValue" class="plain-input" type="number" step="0.01" min="1" max="${Math.max(1,cap)}" value="${Math.min(100,cap)}" ${blocked?'disabled':''}><p id="modalError" class="form-error" hidden></p>${blocked?'<div class="notice negative">Las solicitudes de retiro están temporalmente suspendidas.</div>':'<p class="tiny">Los retiros quedan sujetos a validaciones y condiciones de salida.</p>'}`,blocked?null:()=>{const raw=Number($('#amountValue').value),n=num(raw);if(!Number.isFinite(raw)||n<1||n>cap){err('Introduce una cantidad válida dentro de tu saldo rescatable.');return;}
 let remaining=n;const fromCash=Math.min(account.cash,remaining);account.cash=num(account.cash-fromCash);remaining=num(remaining-fromCash);for(const pos of account.positions){if(remaining<=0)break;const part=Math.min(pos.amount,remaining);pos.amount=num(pos.amount-part);remaining=num(remaining-part);}account.positions=account.positions.filter(p=>p.amount>0);tx('Retiro solicitado',-n,stage>=2?'En validación':'En proceso','withdraw');record('withdraw_attempt',`Solicitó retiro de ${n.toFixed(2)} USDT · ${stage>=2?'En validación':'En proceso'}`);modal('Solicitud registrada',`<p>Solicitud de <strong>${money(n)}</strong> registrada en el historial.</p><p>Estado: <strong>${stage>=2?'En validación':'En proceso'}</strong>. No se ha enviado ninguna criptomoneda.</p>`);},'Solicitar retiro');}
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
$$('.side-link').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));$$('[data-goto]').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.goto)));$$('[data-period]').forEach(b=>b.addEventListener('click',()=>{$$('[data-period]').forEach(a=>a.classList.toggle('active',a===b));record('chart','Consultó gráfica '+b.dataset.period);}));
$$('[data-plan]').forEach(b=>b.addEventListener('click',()=>planSelect(b.dataset.plan)));
$$('[data-document]').forEach(b=>b.addEventListener('click',()=>{const name=b.dataset.document;record('document','Consultó '+name,'documentos');modal(name,`<p>${esc(docs[name]||'Documento no disponible.')}</p>`);}));
$('#actionDeposit').addEventListener('click',deposit);$('#startDeposit').addEventListener('click',deposit);$('#actionWithdraw').addEventListener('click',withdrawal);$('#withdrawInMovements').addEventListener('click',withdrawal);
$('#copyRef').addEventListener('click',async()=>{record('referral','Consultó identificador del programa','referidos');try{await navigator.clipboard.writeText($('#refCode').textContent.trim());modal('Identificador de asociado','Copiado al portapapeles.');}catch{modal('Identificador de asociado',esc($('#refCode').textContent));}});
$('#sendSupport').addEventListener('click',()=>{const r=$('#supportSubject').value,m=$('#supportText').value.trim();if(m.length<5){modal('Falta información','Escribe una consulta de al menos 5 caracteres.');return;}record('support','Envió consulta: '+r,'soporte');$('#supportText').value='';tx('Consulta · '+r,0,'Recibida','support');modal('Consulta registrada','Tu solicitud de atención figura en el historial.');});
$('#closeModal').addEventListener('click',close);overlay.addEventListener('click',e=>{if(e.target===overlay)close();});window.addEventListener('keydown',e=>{if(e.key==='Escape')close();});confirmBtn.addEventListener('click',()=>onConfirm?.());
const exit=document.createElement('button');exit.className='btn btn-soft';exit.textContent='Cerrar sesión';exit.style.marginTop='12px';exit.addEventListener('click',async()=>{record('exit','Cerró sesión');await flush();try{const f=await getFirebase();if(f?.auth.currentUser?.isAnonymous)await f.Auth.signOut(f.auth);}catch{}localStorage.removeItem('ic_v3_alias');localStorage.removeItem('ic_v3_profile');localStorage.removeItem('ic_v3_consent');location.replace('index.html');});$('.side-foot').append(exit);
$('#userAlias').textContent=alias;$('#refCode').textContent='IC-'+Array.from(alias).reduce((sum,c)=>sum+c.charCodeAt(0)*7,4280).toString().slice(-6);render();
(async()=>{try{session=await studentStart(profile);sessionReady=true;$('#syncStatus').textContent=session.mode==='cloud'?'Actividad conectada':'Modo local';record('entry','Entró al panel');await flush();unsubscribe=watchStage(session,setStage,()=>{$('#syncStatus').textContent='Sin conexión';});}catch(e){console.error(e);$('#syncStatus').textContent='Modo local';}})();
window.addEventListener('focus',render);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)render();});
window.setInterval(render,60000);
window.addEventListener('pagehide',()=>unsubscribe());
