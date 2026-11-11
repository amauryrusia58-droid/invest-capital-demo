// Registro de aula: funciona localmente; se sincroniza solo si se habilita Firebase.
const modal=document.getElementById('consent');
const form=document.getElementById('registrationForm');
const nameInput=document.getElementById('studentName');
const contactInput=document.getElementById('studentContact');
const referralInput=document.getElementById('studentReferral');
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
  const rawContact=contactInput.value.trim();
  const contact=rawContact.includes('@')?rawContact.toLowerCase():rawContact;
  const referralCode=referralInput.value.trim();
  if(name.length<3||name.length>60||name.split(' ').length<2){error.textContent='Introduce tu nombre y al menos un apellido (máximo 60 caracteres).';nameInput.focus();return;}
  const emailValid=/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(contact);
  const phoneValid=/^\+?[0-9 ()-]+$/.test(contact) && contact.replace(/\D/g,'').length>=7 && contact.replace(/\D/g,'').length<=15;
  if(contact && (contact.length>120 || (!emailValid && !phoneValid))){
    error.textContent='Introduce un correo electrónico válido o un teléfono con 7 a 15 dígitos; también puedes dejarlo vacío.';
    contactInput.focus();return;
  }
  if(referralCode && !/^IC-[A-Za-z0-9_-]{16,64}$/.test(referralCode)){error.textContent='El código de referido no tiene un formato válido (debe comenzar por IC-).';referralInput.focus();return;}
  if(!consentInput.checked){error.textContent='Debes aceptar las condiciones académicas para continuar.';consentInput.focus();return;}
  // Compatibilidad con Firestore V3.8: el campo interno `email` almacena
  // opcionalmente email O teléfono, y `group` queda vacío. Esto conserva
  // las reglas ya publicadas y no modifica registros de alumnos anteriores.
  const profile={name,email:contact,group:'',referralCode};
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
          nombre_y_apellidos:name,contacto:contact||'No facilitado',codigo_referido:referralCode||'No facilitado',
          mensaje:'Alta de participante de Invest Capital (actividad académica).'
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
