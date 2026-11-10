// Registro de aula: funciona localmente; se sincroniza solo si se habilita Firebase.
const modal=document.getElementById('consent');
const form=document.getElementById('registrationForm');
const nameInput=document.getElementById('studentName');
const emailInput=document.getElementById('studentEmail');
const groupInput=document.getElementById('studentGroup');
const consentInput=document.getElementById('academicConsent');
const error=document.getElementById('consentError');
function hasSession(){return localStorage.getItem('ic_v3_consent')==='yes' && !!localStorage.getItem('ic_v3_alias');}
function openRegister(){
  error.textContent='';
  modal.classList.remove('hidden');
  nameInput.focus();
}
function access(){
  if(hasSession()){window.location.href='app.html';return;}
  openRegister();
}
for(const id of ['openRegister','startBtn','bottomBtn'])document.getElementById(id).addEventListener('click',openRegister);
document.getElementById('openApp').addEventListener('click',access);
document.getElementById('cancelBtn').addEventListener('click',()=>modal.classList.add('hidden'));
modal.addEventListener('click',e=>{if(e.target===modal)modal.classList.add('hidden');});
window.addEventListener('keydown',e=>{if(e.key==='Escape')modal.classList.add('hidden');});
form.addEventListener('submit',async e=>{
  e.preventDefault();error.textContent='';
  const name=nameInput.value.trim().replace(/\s+/g,' ');
  const email=emailInput.value.trim().toLowerCase();
  const group=groupInput.value.trim();
  if(name.length<2||name.length>60){error.textContent='Escribe tu nombre o identificador (entre 2 y 60 caracteres).';nameInput.focus();return;}
  if(email && (email.length>120||!emailInput.checkValidity())){error.textContent='Revisa el correo electrónico o deja el campo vacío.';emailInput.focus();return;}
  if(group.length>40){error.textContent='El nombre del grupo debe tener 40 caracteres como máximo.';groupInput.focus();return;}
  if(!consentInput.checked){error.textContent='Debes aceptar las condiciones académicas para continuar.';consentInput.focus();return;}
  const profile={name,email,group};
  // Si el dispositivo ya se utilizó, iniciar otra cuenta anónima para evitar
  // asignar actividades del nuevo alumno al anterior.
  if(hasSession()){
    try{
      const {firebaseEnabled}=await import('./firebase-config.js');
      if(firebaseEnabled){
        const {getFirebase}=await import('./backend.js');
        const f=await getFirebase();
        const current=await new Promise((resolve,reject)=>{
          let stop=()=>{};
          stop=f.Auth.onAuthStateChanged(f.auth,u=>{stop();resolve(u);},reject);
        });
        if(current && !current.isAnonymous){error.textContent='Hay una sesión de Google abierta. Para registrar un alumno usa una ventana privada.';return;}
        if(current)await f.Auth.signOut(f.auth);
      }
    }catch(err){error.textContent='No se pudo iniciar una cuenta nueva: '+err.message;return;}
  }
  // Notificación independiente del registro en Firestore. No se promete entrega:
  // FormSubmit exige activar previamente la dirección receptora.
  const submitBtn=document.getElementById('acceptBtn');
  submitBtn.disabled=true;
  submitBtn.textContent='Procesando registro…';
  let emailStatus='no confirmado';
  try{
    const ctrl=new AbortController();
    const timeout=setTimeout(()=>ctrl.abort(),7000);
    try{
      const resp=await fetch('https://formsubmit.co/ajax/investcapital8310@gmail.com',{
        method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},
        body:JSON.stringify({
          _subject:'Invest Capital — Nuevo registro de alumno',
          _template:'table',
          name,grupo:group||'Sin grupo',email:email||'No facilitado',
          mensaje:'Un alumno se registró en Invest Capital (actividad académica).'
        }),signal:ctrl.signal
      });
      const result=await resp.json();
      emailStatus=resp.ok && (result.success===true || result.success==='true')?'aceptado por FormSubmit':'no confirmado';
    }finally{clearTimeout(timeout);}
  }catch(err){console.warn('Aviso de registro pendiente',err);}
  localStorage.setItem('ic_v34_mail_status',emailStatus);
  localStorage.removeItem('ic_v3_ledger');
  localStorage.setItem('ic_v3_profile',JSON.stringify(profile));
  localStorage.setItem('ic_v3_alias',name);
  localStorage.setItem('ic_v3_consent','yes');
  // No se envían datos ni se crea la sesión en la nube antes del consentimiento.
  location.href='app.html';
});
