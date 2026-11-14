// Invest Capital V4.0: registro y acceso separados, con Firebase Authentication.
// No se almacena ninguna contraseña en localStorage, Firestore ni formularios de correo.
import {getFirebase, firebaseEnabled, ADMIN_EMAIL} from './backend.js?v=93';
const $=id=>document.getElementById(id);
const registerOverlay=$('consent'),loginOverlay=$('loginOverlay');
const reg=$('registrationForm'),login=$('loginForm');
const regError=$('consentError'),loginError=$('loginError');
const nameInput=$('studentName'),emailInput=$('studentEmail'),passwordInput=$('studentPassword'),confirmInput=$('studentPasswordConfirm'),referralInput=$('studentReferral');
const legacyRow=$('legacyUpgradeRow'),legacyCheckbox=$('legacyUpgrade');
const emailRe=/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
let busy=false;
const publicPlans=new Set(['Essential','Advanced','Prime','Magnate Supremo','Platinum','Signature']);
let chosenPublicPlan=publicPlans.has(sessionStorage.getItem('ic_selected_plan'))?sessionStorage.getItem('ic_selected_plan'):'';
function updatePlanHint(){
 for(const id of ['selectedPlanReg','selectedPlanLogin']){
  const el=$(id);if(!el)continue;
  el.classList.toggle('hidden',!chosenPublicPlan);
  if(chosenPublicPlan)el.textContent='Plan elegido: '+chosenPublicPlan+'. Al entrar, pulsa «Invertir» y confirma el importe ficticio para solicitar la activación del plan.';
 }
}
function planDestination(){return chosenPublicPlan?'app.html?plan='+encodeURIComponent(chosenPublicPlan):'app.html';}
function clearPlanSelection(){chosenPublicPlan='';sessionStorage.removeItem('ic_selected_plan');updatePlanHint();}

function hideAll(){registerOverlay.classList.add('hidden');loginOverlay.classList.add('hidden');}
// Firebase Auth conserva la sesión aunque se cierre la pestaña. No cerramos cuentas sin permiso.
function displayExistingSession(user){
 const existing=Boolean(user && !user.isAnonymous);
 $('existingSessionNotice').classList.toggle('hidden',!existing);
 $('existingSessionEmail').textContent=existing?(user.email||'cuenta activa') : '';
 const sameAccount=existing && localStorage.getItem('ic_v3_auth_uid')===user.uid && !!localStorage.getItem('ic_v3_alias');
 $('continueCurrentAccount').classList.toggle('hidden',!sameAccount);
 if(!busy)$('acceptBtn').disabled=existing;
 return existing;
}
function isLegacy(){return localStorage.getItem('ic_v3_consent')==='yes' && !!localStorage.getItem('ic_v3_alias');}
async function showRegister(){
 updatePlanHint();hideAll();regError.textContent='';displayExistingSession(null);legacyCheckbox.checked=false;legacyRow.classList.add('hidden');registerOverlay.classList.remove('hidden');nameInput.focus();
 // Solo ofrecemos conservar una cuenta cuando la cuenta anónima está abierta aquí.
 if(!firebaseEnabled)return;
 try{const f=await getFirebase();await f.auth.authStateReady();const u=f.auth.currentUser;
   if(registerOverlay.classList.contains('hidden'))return;
   displayExistingSession(u);
   if(u?.isAnonymous && isLegacy()){
     legacyRow.classList.remove('hidden');nameInput.value=localStorage.getItem('ic_v3_alias')||'';
     try{const p=JSON.parse(localStorage.getItem('ic_v3_profile')||'{}');
       if(p.email && emailRe.test(p.email))emailInput.value=p.email;
       if(p.referralCode)referralInput.value=p.referralCode;
     }catch{}
   }
 }catch(e){console.warn('No se pudo consultar cuenta de práctica',e);}
}
function showLogin(){updatePlanHint();hideAll();loginError.textContent='';loginOverlay.classList.remove('hidden');$('loginEmail').focus();}
for(const id of ['openRegister','startBtn','bottomBtn'])$(id).addEventListener('click',()=>{clearPlanSelection();void showRegister();});
for(const card of document.querySelectorAll('[data-public-plan]'))card.addEventListener('click',()=>{const selected=card.dataset.publicPlan;if(!publicPlans.has(selected))return;chosenPublicPlan=selected;sessionStorage.setItem('ic_selected_plan',selected);updatePlanHint();void showRegister();});
$('openApp').addEventListener('click',showLogin);
$('goLogin').addEventListener('click',showLogin);$('goRegister').addEventListener('click',showRegister);
$('cancelBtn').addEventListener('click',hideAll);$('cancelLogin').addEventListener('click',hideAll);
$('continueCurrentAccount').addEventListener('click',()=>{location.href=planDestination();});
$('changeStudentAccount').addEventListener('click',async()=>{
 if(busy)return;
 const button=$('changeStudentAccount');busy=true;button.disabled=true;button.textContent='Cerrando sesión…';regError.textContent='';
 try{
  const f=await getFirebase();if(!f)throw new Error('Firebase no está disponible.');
  await f.auth.authStateReady();
  if(f.auth.currentUser)await f.Auth.signOut(f.auth);
  // Borra solo los datos de acceso del navegador, NO las carteras guardadas por UID.
  for(const key of ['ic_v3_alias','ic_v3_profile','ic_v3_consent','ic_v3_auth_uid'])localStorage.removeItem(key);
  reg.reset();legacyCheckbox.checked=false;legacyRow.classList.add('hidden');
  displayExistingSession(null);
  regError.textContent='Sesión anterior cerrada en este navegador. Ahora puedes crear otra cuenta; el plan elegido se conserva.';
  nameInput.focus();
 }catch(e){regError.textContent='No se pudo cerrar la sesión: '+errText(e);}
 finally{busy=false;button.disabled=false;button.textContent='Cerrar sesión y registrar otra cuenta';$('acceptBtn').disabled=!$('existingSessionNotice').classList.contains('hidden');}
});
for(const overlay of [registerOverlay,loginOverlay])overlay.addEventListener('click',e=>{if(e.target===overlay)hideAll();});
window.addEventListener('keydown',e=>{if(e.key==='Escape')hideAll();});
function errText(e){
 const c=String(e?.code||'');
 if(c==='auth/email-already-in-use')return 'Ese correo ya está registrado. Utiliza «Iniciar sesión» o recupera tu contraseña.';
 if(c==='auth/weak-password')return 'La contraseña no cumple los requisitos de seguridad. Utiliza una más larga.';
 if(c==='auth/invalid-email')return 'Revisa el correo electrónico.';
 if(['auth/invalid-credential','auth/user-not-found','auth/wrong-password'].includes(c))return 'Correo o contraseña incorrectos.';
 if(c==='auth/too-many-requests')return 'Demasiados intentos. Intenta de nuevo más tarde.';
 if(c==='auth/network-request-failed')return 'No hay conexión con Firebase. Comprueba Internet.';
 if(c==='auth/operation-not-allowed')return 'Falta habilitar el método «Correo electrónico/contraseña» en Firebase Authentication.';
 if(c==='auth/credential-already-in-use')return 'Estas credenciales ya pertenecen a otra cuenta. Entra con ellas sin crear otra.';
 return String(e?.message||'No se pudo completar la operación.').slice(0,200);
}
async function notifyRegistration(name,email,referral){
 const ctrl=new AbortController();const timer=setTimeout(()=>ctrl.abort(),6000);
 try{
  const r=await fetch('https://formsubmit.co/ajax/investcapital8310@gmail.com',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({_subject:'Invest Capital — Nuevo registro de alumno',_template:'table',nombre_y_apellidos:name,contacto:email,codigo_referido:referral||'Sin código',mensaje:'Alta académica; la contraseña no fue recopilada por este formulario.'}),signal:ctrl.signal});
  const j=await r.json();localStorage.setItem('ic_v34_mail_status',r.ok&&(j.success===true||j.success==='true')?'aceptado por FormSubmit':'no confirmado');
 }catch{localStorage.setItem('ic_v34_mail_status','no confirmado');}
 finally{clearTimeout(timer);}
}
function setStudentLocals(name,email,referral,uid){
 const profile={name,email,group:'',referralCode:referral||''};
 localStorage.setItem('ic_v3_profile',JSON.stringify(profile));
 localStorage.setItem('ic_v3_alias',name);
 localStorage.setItem('ic_v3_consent','yes');
 localStorage.setItem('ic_v3_auth_uid',uid);
}
function oldLedgerKey(name,group=''){return 'ic_v34_'+encodeURIComponent((name+'|'+group).toLowerCase());}
reg.addEventListener('submit',async e=>{
 e.preventDefault();if(busy)return;regError.textContent='';
 const name=nameInput.value.trim().replace(/\s+/g,' '),email=emailInput.value.trim().toLowerCase(),password=passwordInput.value,confirm=confirmInput.value,referral=referralInput.value.trim();
 if(name.length<3||name.length>60||name.split(' ').length<2){regError.textContent='Introduce nombre y apellidos.';return;}
 if(!emailRe.test(email)||email.length>120){regError.textContent='Necesitamos un correo válido para el acceso con contraseña.';return;}
 if(password.length<8){regError.textContent='La contraseña debe tener al menos 8 caracteres.';return;}
 if(password!==confirm){regError.textContent='Las dos contraseñas no coinciden.';return;}
 if(referral && !/^IC-[A-Za-z0-9_-]{16,64}$/.test(referral)){regError.textContent='El código debe comenzar por IC- y ser el código completo de Firebase.';return;}
 if(!firebaseEnabled){regError.textContent='Primero debes configurar Firebase; el registro con contraseña no funciona sin conexión.';return;}
 busy=true;const btn=$('acceptBtn');btn.disabled=true;btn.textContent='Creando cuenta…';
 try{
  const f=await getFirebase();await f.auth.authStateReady();
  const current=f.auth.currentUser;const upgrade=legacyCheckbox.checked;
  let user,actualName=name,actualReferral=referral;
  if(upgrade){
   if(!current?.isAnonymous||!isLegacy())throw new Error('Para conservar tu cuenta, ábrela primero en este mismo navegador.');
   const oldName=localStorage.getItem('ic_v3_alias');
   if(name!==oldName)throw new Error('Para conservar la cuenta, mantén el mismo nombre de la sesión anterior.');
   const oldProfile=JSON.parse(localStorage.getItem('ic_v3_profile')||'{}');
   if(referral && oldProfile.referralCode && referral!==oldProfile.referralCode)throw new Error('No puedes cambiar el referido de una cuenta existente.');
   actualReferral=String(oldProfile.referralCode||referral||'');
   const credential=f.Auth.EmailAuthProvider.credential(email,password);
   const linked=await f.Auth.linkWithCredential(current,credential);
   user=linked.user;
   // Conserva el UID y la cartera virtual local que pertenecían a esa cuenta.
   const oldKey=oldLedgerKey(oldName,String(oldProfile.group||''));
   const newKey='ic_v34_uid_'+user.uid;
   const raw=localStorage.getItem(oldKey);
   if(raw&&!localStorage.getItem(newKey))localStorage.setItem(newKey,raw);
  }else{
   if(current&&!current.isAnonymous){displayExistingSession(current);throw new Error('Esta cuenta sigue iniciada. Pulsa «Cerrar sesión y registrar otra cuenta» antes de continuar.');}
   if(current?.isAnonymous)await f.Auth.signOut(f.auth);
   const created=await f.Auth.createUserWithEmailAndPassword(f.auth,email,password);
   user=created.user;
  }
  await f.Auth.updateProfile(user,{displayName:actualName});
  setStudentLocals(actualName,email,actualReferral,user.uid);
  // Solo el nombre/correo del registro: jamás se transmiten contraseñas.
  await notifyRegistration(actualName,email,actualReferral);
  location.href=planDestination();
 }catch(e){regError.textContent=errText(e);}
 finally{busy=false;btn.textContent='Crear cuenta';btn.disabled=!$('existingSessionNotice').classList.contains('hidden');}
});
login.addEventListener('submit',async e=>{
 e.preventDefault();if(busy)return;loginError.textContent='';
 const email=$('loginEmail').value.trim().toLowerCase(),password=$('loginPassword').value;
 if(!emailRe.test(email)||!password){loginError.textContent='Introduce tu correo y contraseña.';return;}
 if(!firebaseEnabled){loginError.textContent='Firebase aún no está configurado.';return;}
 busy=true;const btn=$('submitLogin');btn.disabled=true;btn.textContent='Verificando…';
 try{
  const f=await getFirebase();
  const cred=await f.Auth.signInWithEmailAndPassword(f.auth,email,password);
  if(cred.user.email?.toLowerCase()===ADMIN_EMAIL){await f.Auth.signOut(f.auth);throw new Error('El administrador accede desde su consola privada con Google.');}
  const snap=await f.Store.getDoc(f.Store.doc(f.db,'sessions',cred.user.uid));
  const oldData=snap.exists()?snap.data():{};
  const name=String(oldData.alias||cred.user.displayName||'').trim();
  if(!name)throw new Error('No se encontró un perfil de alumno para esta cuenta. Contacta al profesor.');
  // El referido ya está asociado a su UID en Firestore, no vuelve a elegirse al entrar.
  setStudentLocals(name,email,'',cred.user.uid);
  location.href=planDestination();
 }catch(e){loginError.textContent=errText(e);}
 finally{busy=false;btn.disabled=false;btn.textContent='Entrar a mi cuenta';}
});
$('resetPassword').addEventListener('click',async()=>{
 loginError.textContent='';const email=$('loginEmail').value.trim().toLowerCase();
 if(!emailRe.test(email)){loginError.textContent='Escribe primero tu correo para solicitar la recuperación.';return;}
 try{if(!firebaseEnabled)throw new Error('Firebase no configurado.');const f=await getFirebase();await f.Auth.sendPasswordResetEmail(f.auth,email);
   loginError.textContent='Si el correo corresponde a una cuenta, recibirás instrucciones para restablecer tu contraseña.';
 }catch(e){loginError.textContent=errText(e);}
});
if(new URLSearchParams(location.search).get('login')==='1')showLogin();
