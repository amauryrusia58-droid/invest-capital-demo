import {firebaseEnabled} from './firebase-config.js';
const modal=document.getElementById('consent');
const alias=document.getElementById('alias');
const error=document.getElementById('consentError');
function access(){
  const ok=localStorage.getItem('ic_v3_consent')==='yes';
  if(ok && localStorage.getItem('ic_v3_alias')) {window.location.href='app.html';return;}
  modal.classList.remove('hidden');alias.focus();
}
for(const id of ['openApp','startBtn','bottomBtn']) document.getElementById(id).addEventListener('click',access);
document.getElementById('cancelBtn').addEventListener('click',()=>modal.classList.add('hidden'));
document.getElementById('acceptBtn').addEventListener('click',()=>{
  const name=alias.value.trim();
  if(name.length<2 || name.length>30){error.textContent='Escribe un alias de 2 a 30 caracteres.';return;}
  localStorage.setItem('ic_v3_alias',name);localStorage.setItem('ic_v3_consent','yes');
  // No se realizan llamadas al servidor antes del consentimiento.
  window.location.href='app.html';
});
