// Laboratorio del profesor: vista previa local. NO modifica datos de Firebase.
// Mantener las tasas del proyecto en consonancia con app.js.
export const LAB_PLANS=Object.freeze({
  Essential:{amount:100,rate:.02,weeks:8},
  Advanced:{amount:300,rate:.035,weeks:12},
  Prime:{amount:500,rate:.05,weeks:16},
  'Magnate Supremo':{amount:1000,rate:.07,weeks:20},
  Platinum:{amount:1500,rate:.085,weeks:24},
  Signature:{amount:3000,rate:.10,weeks:28}
});
const round=n=>Math.round((Number(n)||0)*100)/100;
const money=n=>round(n).toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})+' USDT-DEMO';
const minRequest=1;
export function calculateLab({plan='Platinum',days=0,bonus=0,paidYield=0,paidBonus=0}={}){
 const cfg=LAB_PLANS[plan]||LAB_PLANS.Platinum;
 const d=Math.max(0,Math.min(30,Math.floor(Number(days)||0)));
 const earned=round(cfg.amount*cfg.rate*Math.min(d,cfg.weeks*7)/7);
 const rewards=Math.max(0,round(bonus));
 const unpaidYield=Math.max(0,round(earned-paidYield));
 const unpaidBonus=Math.max(0,round(rewards-paidBonus));
 return {plan,days:d,amount:cfg.amount,rate:cfg.rate,earned,unpaidYield,unpaidBonus,available:round(unpaidYield+unpaidBonus),remaining:Math.max(0,30-d)};
}
// La simulación de aprobación NO accede a cuentas de terceros.
export function approveLabWithdrawal(state,amount){
 const data=calculateLab(state),n=round(amount);
 if(!Number.isFinite(Number(amount))||n<minRequest||n>data.available)return null;
 const bonusUsed=Math.min(n,data.unpaidBonus);
 return {...state,paidBonus:round((state.paidBonus||0)+bonusUsed),paidYield:round((state.paidYield||0)+round(n-bonusUsed))};
}
let started=false;
export function initTeacherLab(){
 if(started)return;
 const root=document.getElementById('teacherLab');if(!root)return;
 started=true;
 const $=id=>document.getElementById(id);
 let state={plan:'Platinum',days:0,bonus:0,paidYield:0,paidBonus:0};
 let pending=null;
 const notice=(text,tone='')=>{$('labNotice').textContent=text;$('labNotice').dataset.tone=tone;};
 const cleanPending=()=>{pending=null;$('labReview').classList.add('hidden');};
 function drawChart(data){
  const curve=d=>calculateLab({...state,days:d}).earned;
  const max=Math.max(curve(30),1),px=d=>26+d*584/30,py=d=>135-112*curve(d)/max;
  const points=(a,b)=>Array.from({length:Math.max(1,b-a+1)},(_,i)=>a+i).map(i=>`${px(i).toFixed(1)},${py(i).toFixed(1)}`).join(' ');
  $('labChartPast').setAttribute('points',points(0,data.days));
  $('labChartFuture').setAttribute('points',points(data.days,30));
  $('labChartDot').setAttribute('cx',String(px(data.days)));
  $('labChartDot').setAttribute('cy',String(py(data.days)));
 }
 function render(){
  const data=calculateLab(state);
  $('labDays').value=String(data.days);$('labDaysValue').textContent=String(data.days);
  $('labPlan').value=data.plan;
  $('labCapital').textContent=money(data.amount);
  $('labRate').textContent=`Tasa semanal hipotética: ${(data.rate*100).toLocaleString('es-ES',{maximumFractionDigits:1})} %`;
  $('labProfit').textContent=money(data.earned);
  $('labAvailable').textContent=money(data.available);
  $('labRemaining').textContent=String(data.remaining);
  $('labWithdrawAmount').max=String(data.available);
  $('labRequest').disabled=Boolean(pending)||data.available<minRequest;
  if(!pending && (Number($('labWithdrawAmount').value)>data.available || Number($('labWithdrawAmount').value)<1))$('labWithdrawAmount').value='1';
  for(const btn of root.querySelectorAll('[data-lab-days]'))btn.setAttribute('aria-pressed',String(Number(btn.dataset.labDays)===data.days));
  if(pending){$('labPendingText').textContent=`Solicitud ficticia de ${money(pending.amount)} · pendiente de revisión`;}
  drawChart(data);
 }
 function reset(message){state={plan:$('labPlan').value,days:Number($('labDays').value)||0,bonus:Number($('labReferral').value)||0,paidYield:0,paidBonus:0};cleanPending();render();notice(message);}
 $('labPlan').addEventListener('change',()=>reset('Plan cambiado. Comienza una prueba nueva sin afectar cuentas de alumnos.'));
 $('labReferral').addEventListener('change',()=>{
  const n=Number($('labReferral').value);
  if(!Number.isFinite(n)||n<0||n>1000000){$('labReferral').value=String(state.bonus);notice('Introduce una bonificación ficticia entre 0 y 1.000.000.','error');return;}
  reset('Bonificación modificada. Se reinició el historial de aprobaciones de esta prueba.');
 });
 function setDays(day){
  const newDay=Math.max(0,Math.min(30,Math.floor(Number(day)||0)));
  if(newDay<state.days && (state.paidYield>0||state.paidBonus>0)){
   state.paidYield=0;state.paidBonus=0;cleanPending();
   notice('Retrocediste el calendario de prueba. Se reiniciaron los retiros ensayados, sin modificar datos reales.');
  }else if(!pending){notice(newDay===0?'Día 0: comprueba si hay bonificaciones ficticias para retiro.':`Día ${newDay}: rendimiento de práctica calculado. Puedes ensayar el retiro mínimo de 1 USDT-DEMO.`);}
  state.days=newDay;render();
 }
 $('labDays').addEventListener('input',e=>setDays(e.target.value));
 root.querySelectorAll('[data-lab-days]').forEach(b=>b.addEventListener('click',()=>setDays(b.dataset.labDays)));
 $('labRequest').addEventListener('click',()=>{
  const raw=$('labWithdrawAmount').value;
  const value=Number(raw),amount=round(value),data=calculateLab(state);
  if(!raw.trim()||!Number.isFinite(value)||amount<minRequest||amount>data.available){notice(`No se puede solicitar ese importe. Mínimo ${money(minRequest)}; disponible ${money(data.available)}.`,'error');return;}
  if(pending){notice('Ya existe una solicitud pendiente en esta prueba.','error');return;}
  pending={amount};$('labReview').classList.remove('hidden');
  notice(`Solicitud de ${money(amount)} pendiente de revisión. Esto NO se envía a Firebase.`);render();
 });
 $('labApprove').addEventListener('click',()=>{
  if(!pending)return;
  const next=approveLabWithdrawal(state,pending.amount);
  if(!next){notice('La solicitud supera el saldo ficticio disponible. Reinicia la prueba.','error');return;}
  const amount=pending.amount;state=next;cleanPending();render();
  notice(`APROBADO EN LA PRUEBA: ${money(amount)} descontados de ganancias disponibles. El capital del plan no cambia.`,'good');
 });
 $('labReject').addEventListener('click',()=>{
  if(!pending)return;
  const amount=pending.amount;cleanPending();render();
  notice(`RECHAZADO EN LA PRUEBA: ${money(amount)} no se descuentan; el contador y las ganancias siguen iguales.`);
 });
 $('labReset').addEventListener('click',()=>{
  $('labDays').value='0';$('labReferral').value='0';$('labWithdrawAmount').value='1';
  state={plan:$('labPlan').value,days:0,bonus:0,paidYield:0,paidBonus:0};cleanPending();render();notice('Laboratorio reiniciado. No se modificó ningún registro de alumnos.');
 });
 render();
}
