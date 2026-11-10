import {studentStart, logStudent, watchStage, firebaseEnabled, getFirebase} from './backend.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const alias = (localStorage.getItem('ic_v3_alias') || '').trim();
if (localStorage.getItem('ic_v3_consent') !== 'yes' || !alias) location.replace('index.html');

const titles = {
  resumen:['Resumen de cuenta','Estado general de tu cartera'],
  planes:['Planes de inversión','Condiciones y oportunidades de gestión'],
  cartera:['Mi cartera','Posiciones y distribución de activos'],
  movimientos:['Historial de movimientos','Operaciones registradas en tu cuenta'],
  referidos:['Programa de asociados','Información de tu red de asociados'],
  documentos:['Centro documental','Información corporativa y condiciones'],
  soporte:['Centro de atención','Gestión de solicitudes y consultas']
};
const base = [
  {name:'Aporte inicial',ref:'INV-48210',amount:1500,date:'04/02/2026',status:'Acreditado'},
  {name:'Asignación a estrategia Advanced',ref:'ALG-40111',amount:-500,date:'16/02/2026',status:'Procesado'},
  {name:'Rendimiento de cartera',ref:'RNT-77702',amount:137.25,date:'03/03/2026',status:'Aplicado'},
  {name:'Retiro solicitado',ref:'OUT-60713',amount:-85,date:'18/03/2026',status:'Liquidado'},
  {name:'Bonificación de asociados',ref:'ASO-50312',amount:48,date:'08/04/2026',status:'Aplicado'},
  {name:'Aporte adicional',ref:'INV-72509',amount:500,date:'20/04/2026',status:'Acreditado'}
];
const money = n => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n);
let view='resumen', stage=0, session={mode:'local'}, unsubscribe=()=>{}, ledger=[];
const overlay=$('#actionModal'), modalTitle=$('#modalTitle'), modalContent=$('#modalContent'), confirmBtn=$('#confirmModal');
let onConfirm=null;
try {let saved=JSON.parse(localStorage.getItem('ic_v3_ledger')||'[]'); if(Array.isArray(saved))ledger=saved.filter(x=>x && typeof x.name==='string' && Number.isFinite(x.amount)).slice(0,100);}catch{}

function saveLedger(){localStorage.setItem('ic_v3_ledger',JSON.stringify(ledger.slice(0,100)));}
function record(type,label,which=view){
  void logStudent(session,type,label,which).catch(()=>{$('#syncStatus').textContent='Conexión pendiente';});
}
function setView(v){
 if(!titles[v])return;
 view=v;
 $$('.workspace-section').forEach(e=>e.classList.toggle('active',e.dataset.section===v));
 $$('.side-link').forEach(e=>{e.classList.toggle('active',e.dataset.view===v);e.setAttribute('aria-current',e.dataset.view===v?'page':'false');});
 $('#viewTitle').textContent=titles[v][0];$('#viewSubtitle').textContent=titles[v][1];
 record('section',`Abrió ${titles[v][0]}`,v);
 window.scrollTo({top:0,behavior:'smooth'});
}
function openModal(title,html,callback=null,buttonLabel='Confirmar'){
 modalTitle.textContent=title;
 modalContent.innerHTML=html;
 onConfirm=callback;
 confirmBtn.classList.toggle('hidden',!callback);
 confirmBtn.textContent=buttonLabel;
 overlay.classList.remove('hidden');
 confirmBtn.disabled=false;
}
function closeModal(){overlay.classList.add('hidden');onConfirm=null;}
function errorModal(text){ const err=$('#modalError');if(err){err.textContent=text;err.hidden=false;} }
function addMove(name,amount,status='Pendiente'){
 ledger.unshift({name,ref:'IC-'+String(Date.now()).slice(-8),amount,date:new Date().toLocaleDateString('es-ES'),status});
 ledger=ledger.slice(0,100);saveLedger();renderLedger();renderBalances();
}
function rowMarkup(x){
 const tone=/pendiente|revisión|validación|proceso|programado/i.test(x.status)?'warn':/suspend|rechaz/i.test(x.status)?'danger':'';
 const amt=(x.amount>0?'+ ':'')+money(x.amount);
 return `<td>${escapeHTML(x.name)}</td><td>${escapeHTML(x.ref)}</td><td>${amt}</td><td>${escapeHTML(x.date)}</td><td><span class="tag ${tone}">${escapeHTML(x.status)}</span></td>`;
}
function escapeHTML(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function renderLedger(){
 const all=[...ledger,...(stage>=2?[{name:'Solicitud de retiro bajo revisión',ref:'OUT-80271',amount:-220,date:'22/05/2026',status:stage===3?'Suspendido':'En validación'}]:[]),...base];
 $('#fullRows').innerHTML=all.map(x=>`<tr>${rowMarkup(x)}</tr>`).join('');
 $('#recentRows').innerHTML=all.slice(0,4).map(x=>`<tr><td>${escapeHTML(x.name)}</td><td>${escapeHTML(x.date)}</td><td>${(x.amount>0?'+ ':'')+money(x.amount)}</td><td><span class="tag ${/suspend/i.test(x.status)?'danger':/revisión|validación|proceso/i.test(x.status)?'warn':''}">${escapeHTML(x.status)}</span></td></tr>`).join('');
}
function available(){
 const delta=ledger.reduce((sum,x)=>sum+(x.name==='Capital asignado a cartera'?0:x.name==='Aporte a cuenta'?x.amount:x.name==='Retiro solicitado'?-Math.abs(x.amount):0),0);
 return Math.max(0,314.8+delta);
}
function renderBalances(){
 const virtualAdd=ledger.filter(x=>x.name==='Aporte a cuenta').reduce((s,x)=>s+x.amount,0);
 const virtualWithdraw=ledger.filter(x=>x.name==='Retiro solicitado').reduce((s,x)=>s+Math.abs(x.amount),0);
 const bonus=stage===0?0:stage===1?216.42:stage===2?223.10:223.10;
 $('#totalVal').textContent=money(2450.70+virtualAdd-virtualWithdraw+bonus);
 $('#gainVal').textContent=money(450.70+bonus);
 $('#availableVal').textContent=money(stage===3?0:available());
 $('#availabilityStatus').textContent=stage===3?'Operaciones temporalmente suspendidas':stage===2?'Operaciones sujetas a validación':'Disponible para solicitudes';
 const msg=$('#scenarioNotice');
 const messages=['','Actualización de resultados: el crecimiento acumulado del trimestre fue revisado al alza.','Comunicado operativo: las solicitudes de retiro están sujetas a validaciones adicionales.','Comunicado operativo: se suspenden temporalmente nuevos retiros mientras continúa la revisión de liquidez.'];
 msg.classList.toggle('hidden',stage===0);msg.classList.toggle('negative',stage>=2);msg.textContent=messages[stage]||'';
 $('#supportStatus').textContent=stage===3?'Servicio limitado: solicitudes de retiro suspendidas.':stage===2?'Volumen elevado de consultas; tiempos de respuesta ampliados.':'Los canales de atención están operativos.';
 renderLedger();
}
function setStage(next){
 stage=Math.max(0,Math.min(3,Number(next)||0));renderBalances();
}
const docs={
 'Resumen de servicios':`La entidad declara la prestación de servicios de gestión digital de cartera y asignaciones a estrategias algorítmicas. Los resultados publicados se elaboran a partir de registros operativos internos. La identificación de custodios y contrapartes no figura en este resumen.`,
 'Metodología de resultados':`La cifra de rentabilidad se calcula sobre el capital asignado al comienzo del periodo. El modelo incorpora operaciones automatizadas y posiciones en mercados digitales. La metodología íntegra de valuación y el detalle de operaciones no se publican. No se adjunta un informe independiente de auditoría.`,
 'Estado de registros y autorizaciones':`Documentación corporativa: inscripción de actividad comercial declarada. Número de licencia para gestión de inversiones: no facilitado en el expediente consultable. Autoridad supervisora y país de autorización: pendientes de confirmación documental.`,
 'Condiciones de salida':`Las solicitudes se procesan según disponibilidad de liquidez y validaciones internas. El plazo operativo habitual anunciado es de hasta 15 días hábiles; la compañía se reserva la posibilidad de modificar plazos en circunstancias extraordinarias.`
};

// Navigación interna
$$('.side-link').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));
$$('[data-goto]').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.goto)));
$$('[data-period]').forEach(b=>b.addEventListener('click',()=>{
 $$('[data-period]').forEach(a=>a.classList.toggle('active',a===b));
 const chart=b.dataset.period==='12M'?'0,204 63,188 124,181 185,159 242,162 299,130 357,140 409,112 466,107 526,89 588,67 645,47 700,26':'0,196 80,184 170,160 270,149 360,127 460,106 570,64 700,37';
 $('#chartLine').setAttribute('points',chart);const pts=chart.replace(/,/g,' ').split(' ').filter(Boolean);$('#chartArea').setAttribute('d','M'+chart.replace(/ /g,' L').replace(/,/g,' ')+' L700 230 L0 230 Z');
 record('chart','Cambió periodo del gráfico a '+b.dataset.period);
}));
$$('[data-plan]').forEach(b=>b.addEventListener('click',()=>{
 const plan=b.dataset.plan;
 const rates={Essential:'1,2 %',Advanced:'2,1 %',Prime:'3,0 %'};
 record('plan_view','Consultó condiciones de '+plan,'planes');
 openModal('Condiciones · '+plan,`<p>Rendimiento semanal anunciado: <b>${rates[plan]}</b>. Los importes pueden variar; el rendimiento no se acredita necesariamente hasta el cierre del periodo.</p><p>La liquidación queda sujeta a las condiciones de salida publicadas por la entidad.</p><div class="modal-note">Para solicitar la activación de este plan, selecciona «Solicitar asignación».</div>`,()=>{
 addMove('Solicitud de activación · '+plan,0,'En revisión');record('plan_request','Solicitó activar plan '+plan,'planes');openModal('Solicitud recibida','Tu solicitud ha sido registrada y figura como pendiente en el historial.');
 },'Solicitar asignación');
}));
$$('[data-document]').forEach(b=>b.addEventListener('click',()=>{
 const name=b.dataset.document; record('document','Consultó '+name,'documentos');
 openModal(name,`<p>${escapeHTML(docs[name]||'Documento no disponible.')}</p>`);
}));
$('#actionDeposit').addEventListener('click',()=>{
 record('deposit_open','Abrió la opción Añadir capital');
 openModal('Añadir capital',`<p>Solicita una asignación adicional para tu cartera. La operación se reflejará en el historial de cuenta.</p><label class="field-label" for="amountValue">Importe (USD)</label><input id="amountValue" type="number" class="plain-input" min="100" max="10000" value="250" step="50"><p id="modalError" class="form-error" hidden></p><p class="tiny">No se solicitan tarjetas, transferencias ni direcciones de criptomonedas.</p>`,()=>{
 const n=Number($('#amountValue').value);if(!Number.isFinite(n)||n<100||n>10000){errorModal('El importe permitido es de 100 a 10.000 USD.');return;}
 addMove('Aporte a cuenta',n,'Acreditado');record('deposit_attempt','Añadió capital por '+money(n));openModal('Operación registrada','El importe figura ahora en el estado de tu cuenta.');
 },'Confirmar operación');
});
function withdrawal(){
 record('withdraw_open','Abrió formulario de retiro');
 const can=stage===3?0:available();
 openModal('Solicitud de retiro',`<p>Saldo disponible mostrado: <b>${money(can)}</b>.</p><label class="field-label" for="amountValue">Importe (USD)</label><input id="amountValue" type="number" class="plain-input" min="1" max="${Math.max(1,can)}" value="${Math.min(100,Math.floor(can))}" step="1" ${stage===3?'disabled':''}><p id="modalError" class="form-error" hidden></p>${stage===3?'<div class="notice negative">El servicio de retiros no se encuentra disponible temporalmente.</div>':'<p class="tiny">La solicitud aparecerá en el historial de cuenta.</p>'}`,stage===3?null:()=>{
 const n=Number($('#amountValue').value);if(!Number.isFinite(n)||n<1||n>available()){errorModal('Introduce un importe válido dentro del saldo disponible.');return;}
 const status=stage>=2?'En validación':'En proceso';
 addMove('Retiro solicitado',-n,status);record('withdraw_attempt','Solicitó retiro de '+money(n)+' — '+status);openModal('Solicitud registrada',`<p>Referencia generada. Estado: <b>${status}</b>.</p><p>Consulta el historial de movimientos para continuar el seguimiento.</p>`);
 },'Solicitar retiro');
}
$('#actionWithdraw').addEventListener('click',withdrawal);
$('#withdrawInMovements').addEventListener('click',withdrawal);
$('#copyRef').addEventListener('click',async()=>{
 record('referral','Consultó o copió identificador de asociados','referidos');
 try{await navigator.clipboard.writeText($('#refCode').textContent.trim());openModal('Código de asociado','Identificador copiado al portapapeles.');}
 catch{openModal('Código de asociado',`<p>${escapeHTML($('#refCode').textContent)}</p>`);}
});
$('#sendSupport').addEventListener('click',()=>{
 const reason=$('#supportSubject').value, message=$('#supportText').value.trim();
 if(message.length<5){openModal('Falta información','Escribe una consulta de al menos 5 caracteres.');return;}
 // Solo se registra el motivo. Nunca se transmite el texto libre del alumno.
 record('support','Envió consulta: '+reason,'soporte');$('#supportText').value='';
 addMove('Consulta · '+reason,0,'Recibida');
 openModal('Solicitud de atención','Tu consulta se ha registrado correctamente.');
});
$('#closeModal').addEventListener('click',closeModal);
overlay.addEventListener('click',e=>{if(e.target===overlay)closeModal();});
window.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal();});
confirmBtn.addEventListener('click',()=>{if(onConfirm)onConfirm();});

// Salir y cambiar de alumno en un equipo compartido.
const exit=document.createElement('button');exit.className='btn btn-soft';exit.textContent='Cerrar sesión';exit.style.marginTop='12px';
exit.addEventListener('click',async()=>{
 record('exit','Cerró sesión');
 try{const f=await getFirebase();if(f&&f.auth.currentUser?.isAnonymous)await f.Auth.signOut(f.auth);}catch{}
 localStorage.removeItem('ic_v3_alias');localStorage.removeItem('ic_v3_consent');localStorage.removeItem('ic_v3_ledger');location.replace('index.html');
});
$('.side-foot').append(exit);
$('#userAlias').textContent=alias;
renderBalances();
(async()=>{
 try{
   session=await studentStart(alias);
   $('#syncStatus').textContent=session.mode==='cloud'?'Actividad conectada':'Modo local';
   record('entry','Entró al panel');
   unsubscribe=watchStage(session,setStage,()=>{$('#syncStatus').textContent='Sincronización interrumpida';});
 }catch(err){console.error(err);$('#syncStatus').textContent='Sin conexión';}
})();
window.addEventListener('pagehide',()=>unsubscribe());
