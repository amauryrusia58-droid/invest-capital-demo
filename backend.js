import {firebaseConfig, firebaseEnabled, ADMIN_EMAIL} from './firebase-config.js';
let firebaseCache;
export {firebaseEnabled, ADMIN_EMAIL};
export async function getFirebase(){
 if(!firebaseEnabled) return null;
 if(firebaseCache) return firebaseCache;
 firebaseCache=(async()=>{
   const [{initializeApp,getApps,getApp},Auth,Store]=await Promise.all([
     import('https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js'),
     import('https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js'),
     import('https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js')
   ]);
   const app=getApps().length?getApp():initializeApp(firebaseConfig);
   return {app,auth:Auth.getAuth(app),db:Store.getFirestore(app),Auth,Store};
 })();
 return firebaseCache;
}
async function authUser(auth,Auth){return await new Promise((resolve,reject)=>{let off=()=>{};off=Auth.onAuthStateChanged(auth,u=>{off();resolve(u);},reject);});}
export async function studentStart(profile){
 const name=String(profile?.name||profile?.alias||'').trim().slice(0,60);
 const email=String(profile?.email||'').trim().toLowerCase().slice(0,120);
 const group=String(profile?.group||'').trim().slice(0,40);
 const alias=name;
 const f=await getFirebase();if(!f)return {mode:'local',uid:'local'};
 const {auth,db,Auth,Store}=f;
 let user=await authUser(auth,Auth);
 if(!user) throw new Error('Tu sesión ha caducado. Vuelve a iniciar sesión desde la portada.');
 if(!user.isAnonymous && !user.providerData.some(p=>p.providerId==='password')) throw new Error('Debes entrar con tu cuenta de alumno, no con Google.');
 const ref=Store.doc(db,'sessions',user.uid);
 const snap=await Store.getDoc(ref);
 const data={view:'resumen',lastAction:'Acceso al panel',lastSeen:Store.serverTimestamp()};
 if(!snap.exists()) await Store.setDoc(ref,{alias,email,group,createdAt:Store.serverTimestamp(),...data});
 else await Store.updateDoc(ref,data);
 return {mode:'cloud',uid:user.uid,db,Store};
}
export async function logStudent(session,type,label,view){
 if(session.mode!=='cloud')return;
 const {uid,db,Store}=session;
 const safeType=String(type).slice(0,30),safeLabel=String(label).slice(0,120),safeView=String(view).slice(0,30);
 const batch=Store.writeBatch(db);
 const evt=Store.doc(Store.collection(db,'sessions',uid,'events'));
 batch.set(evt,{type:safeType,label:safeLabel,view:safeView,createdAt:Store.serverTimestamp()});
 batch.update(Store.doc(db,'sessions',uid),{lastAction:safeLabel,view:safeView,lastSeen:Store.serverTimestamp()});
 await batch.commit();
}
export function watchStage(session,onChange,onError){
 if(session.mode!=='cloud')return ()=>{};
 const {db,Store}=session;
 return Store.onSnapshot(Store.doc(db,'control','global'),snap=>onChange(snap.exists()?Number(snap.data().stage)||0:0),onError);
}
export async function adminLogin(){
 const f=await getFirebase();if(!f)throw new Error('Primero configura Firebase en firebase-config.js.');
 const {Auth,auth}=f;
 const provider=new Auth.GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});
 const result=await Auth.signInWithPopup(auth,provider);
 if(result.user.email?.toLowerCase()!==ADMIN_EMAIL || !result.user.emailVerified){await Auth.signOut(auth);throw new Error('Esta cuenta no está autorizada como administrador.');}
 return f;
}
export async function adminCurrent(){
 const f=await getFirebase();if(!f)return null;
 const user=await authUser(f.auth,f.Auth);
 return (user?.email?.toLowerCase()===ADMIN_EMAIL && user.emailVerified && user.providerData.some(p=>p.providerId==='google.com'))?f:null;
}


// REFERIDOS DE AULA - sin direcciones de pago, invitaciones públicas ni fondos reales.
// Se usa el UID completo de Firebase para evitar colisiones de códigos por alias.
export function classroomCode(uid){return 'IC-'+String(uid||'');}
export function uidFromCode(code){
 const text=String(code||'').trim();
 return /^IC-[A-Za-z0-9_-]{16,64}$/.test(text)?text.slice(3):null;
}
export async function getClassroomLink(session){
 if(session.mode!=='cloud')return null;
 const {db,Store,uid}=session;
 const ref=Store.doc(db,'referralLinks',uid);
 const snap=await Store.getDoc(ref);
 return snap.exists()?snap.data().inviterUid:null;
}
export async function linkClassroomMember(session,code){
 if(session.mode!=='cloud')throw new Error('Necesitas Firebase para vincular cuentas del aula.');
 const inviterUid=uidFromCode(code);
 if(!inviterUid)throw new Error('El código debe comenzar por IC- y pertenecer a una cuenta de práctica.');
 if(inviterUid===session.uid)throw new Error('No puedes asociarte a tu propia cuenta.');
 const {db,Store,uid}=session;
 const ref=Store.doc(db,'referralLinks',uid);
 const previous=await Store.getDoc(ref);
 if(previous.exists()){
   if(previous.data().inviterUid===inviterUid)return inviterUid;
   throw new Error('Tu sesión ya está vinculada a otro compañero; esa relación no puede cambiarse.');
 }
 // Firestore verifica que el invitador existe y se registró antes que esta cuenta.
 await Store.setDoc(ref,{inviterUid,createdAt:Store.serverTimestamp()});
 return inviterUid;
}
export async function classroomAncestors(session){
 if(session.mode!=='cloud')return [];
 const result=[],visited=new Set([session.uid]);let uid=session.uid;
 for(let i=0;i<3;i++){
   const snap=await session.Store.getDoc(session.Store.doc(session.db,'referralLinks',uid));
   if(!snap.exists())break;
   const parent=snap.data().inviterUid;
   if(typeof parent!=='string'||visited.has(parent))break;
   visited.add(parent);result.push(parent);uid=parent;
 }
 return result;
}
export async function recordClassroomContribution(session,amount,reference){
 if(session.mode!=='cloud')return false;
 const ancestors=await classroomAncestors(session);
 if(!ancestors.length)return false;
 const {db,Store,uid}=session;
 const n=Math.round(Number(amount)*100)/100;
 if(!(n>=1&&n<=100000))throw new Error('Importe de práctica fuera de rango.');
 const safeRef=String(reference).slice(0,35);
 const docId=uid+'_'+safeRef;
 await Store.setDoc(Store.doc(db,'virtualContributions',docId),{
   sourceUid:uid,sourceTag:'AL-'+uid.slice(0,6),ancestors,
   reference:safeRef,amount:n,createdAt:Store.serverTimestamp()
 });
 return true;
}
export function watchClassroomRewards(session,onChange,onError){
 if(session.mode!=='cloud')return ()=>{};
 const {db,Store,uid}=session;
 const q=Store.query(Store.collection(db,'virtualContributions'),Store.where('ancestors','array-contains',uid));
 return Store.onSnapshot(q,snap=>onChange(snap.docs.map(d=>({id:d.id,...d.data()}))),onError);
}

// V5 · Solicitudes de saldo exclusivamente virtual. No pagos, carteras ni transferencias.
export async function requestVirtualCredit(session, amount, studentAlias){
 if(session.mode!=='cloud')throw new Error('La solicitud requiere conexión con Firebase.');
 const n=Math.round(Number(amount)*100)/100;
 if(!Number.isFinite(n)||n<1||n>100000)throw new Error('Cantidad ficticia fuera de rango.');
 const {db,Store,uid}=session;
 // Verificación adicional en servidor. Evita duplicados accidentales entre recargas,
 // navegadores y solicitudes repetidas mientras hay una revisión pendiente.
 const pendingQuery=Store.query(Store.collection(db,'virtualCreditRequests'),Store.where('studentUid','==',uid));
 const current=await Store.getDocs(pendingQuery);
 if(current.docs.some(d=>d.data()?.status==='pending')){
  throw new Error('Ya tienes una solicitud de capital ficticio pendiente de aprobación. No la envíes otra vez.');
 }
 const ref=await Store.addDoc(Store.collection(db,'virtualCreditRequests'),{
  studentUid:uid,studentAlias:String(studentAlias||'Alumno').trim().slice(0,60),
  amount:n,currency:'USDT-DEMO',status:'pending',createdAt:Store.serverTimestamp()
 });
 return ref.id;
}
export function watchVirtualCreditRequests(session,onChange,onError){
 if(session.mode!=='cloud')return ()=>{};
 const {db,Store,uid}=session;
 // El filtro de propietario es indispensable para cumplir las reglas Firestore.
 const q=Store.query(Store.collection(db,'virtualCreditRequests'),Store.where('studentUid','==',uid));
 return Store.onSnapshot(q,snap=>onChange(snap.docs.map(d=>({id:d.id,...d.data()}))),onError);
}
export function watchAdminVirtualCreditRequests(f,onChange,onError){
 const {db,Store}=f;
 return Store.onSnapshot(Store.query(Store.collection(db,'virtualCreditRequests'),Store.orderBy('createdAt','desc'),Store.limit(200)),
  snap=>onChange(snap.docs.map(d=>({id:d.id,...d.data()}))),onError);
}
export async function reviewVirtualCreditRequest(f,requestId,decision){
 if(!['approved','rejected'].includes(decision))throw new Error('Decisión no válida.');
 if(!/^[A-Za-z0-9]{15,40}$/.test(String(requestId)))throw new Error('Referencia de solicitud no válida.');
 const {db,Store}=f,ref=Store.doc(db,'virtualCreditRequests',requestId);
 await Store.runTransaction(db,async tx=>{
  const snap=await tx.get(ref);
  if(!snap.exists())throw new Error('No se encuentra la solicitud.');
  if(snap.data().status!=='pending')throw new Error('La solicitud ya fue revisada.');
  tx.update(ref,{status:decision,decisionAt:Store.serverTimestamp(),decidedBy:ADMIN_EMAIL});
 });
}

// V6 · Peticiones de retirada de saldo exclusivamente ficticio.
export async function requestVirtualWithdrawal(session, amount, studentAlias){
 if(session.mode!=='cloud')throw new Error('Necesitas conexión con Firebase para solicitar el retiro de práctica.');
 const n=Math.round(Number(amount)*100)/100;
 if(!Number.isFinite(n)||n<1||n>100000)throw new Error('Cantidad virtual fuera de rango.');
 const {db,Store,uid}=session;
 const ref=await Store.addDoc(Store.collection(db,'virtualWithdrawalRequests'),{
  studentUid:uid,studentAlias:String(studentAlias||'Alumno').trim().slice(0,60),
  amount:n,currency:'USDT-DEMO',status:'pending',createdAt:Store.serverTimestamp()
 });
 return ref.id;
}
export function watchVirtualWithdrawalRequests(session,onChange,onError){
 if(session.mode!=='cloud')return ()=>{};
 const {db,Store,uid}=session;
 const q=Store.query(Store.collection(db,'virtualWithdrawalRequests'),Store.where('studentUid','==',uid));
 return Store.onSnapshot(q,snap=>onChange(snap.docs.map(d=>({id:d.id,...d.data()}))),onError);
}
export function watchAdminVirtualWithdrawalRequests(f,onChange,onError){
 const {db,Store}=f;
 return Store.onSnapshot(Store.query(Store.collection(db,'virtualWithdrawalRequests'),Store.orderBy('createdAt','desc'),Store.limit(200)),
  snap=>onChange(snap.docs.map(d=>({id:d.id,...d.data()}))),onError);
}
export async function reviewVirtualWithdrawalRequest(f,requestId,decision){
 if(!['approved','rejected'].includes(decision))throw new Error('Decisión inválida.');
 if(!/^[A-Za-z0-9]{15,40}$/.test(String(requestId)))throw new Error('Referencia inválida.');
 const {db,Store}=f,ref=Store.doc(db,'virtualWithdrawalRequests',requestId);
 await Store.runTransaction(db,async tx=>{
  const snap=await tx.get(ref);
  if(!snap.exists())throw new Error('La solicitud no existe.');
  if(snap.data().status!=='pending')throw new Error('La solicitud ya tiene una decisión.');
  tx.update(ref,{status:decision,decisionAt:Store.serverTimestamp(),decidedBy:ADMIN_EMAIL});
 });
}

// V8.3 · Activación de PLAN con USDT DEMO. Nunca se envía dinero ni una transacción blockchain.
const CLASSROOM_PLAN_AMOUNTS={Essential:100,Advanced:300,Prime:500,'Magnate Supremo':1000,Platinum:1500,Signature:3000};
export async function requestVirtualPlanActivation(session,plan,studentAlias){
 if(session.mode!=='cloud')throw new Error('Debes estar conectado a Firebase para este ejercicio.');
 if(!Object.hasOwn(CLASSROOM_PLAN_AMOUNTS,plan))throw new Error('Plan de práctica no reconocido.');
 const {db,Store,uid}=session;
 const q=Store.query(Store.collection(db,'virtualPlanRequests'),Store.where('studentUid','==',uid));
 const snap=await Store.getDocs(q);
 if(snap.docs.some(d=>d.data()?.status==='pending'))throw new Error('Ya hay una activación pendiente de revisión.');
 if(snap.docs.some(d=>d.data()?.status==='approved'&&d.data()?.plan===plan))throw new Error('Este plan ya tiene una activación aprobada. Revisa tu cartera.');
 const ref=await Store.addDoc(Store.collection(db,'virtualPlanRequests'),{
  studentUid:uid,studentAlias:String(studentAlias||'Alumno').trim().slice(0,60),
  plan,amount:CLASSROOM_PLAN_AMOUNTS[plan],currency:'USDT-DEMO',status:'pending',createdAt:Store.serverTimestamp()
 });
 return ref.id;
}
export function watchVirtualPlanRequests(session,onChange,onError){
 if(session.mode!=='cloud')return ()=>{};
 const {db,Store,uid}=session;
 return Store.onSnapshot(Store.query(Store.collection(db,'virtualPlanRequests'),Store.where('studentUid','==',uid)),
  snap=>onChange(snap.docs.map(d=>({id:d.id,...d.data()}))),onError);
}
export function watchAdminVirtualPlanRequests(f,onChange,onError){
 const {db,Store}=f;
 return Store.onSnapshot(Store.query(Store.collection(db,'virtualPlanRequests'),Store.orderBy('createdAt','desc'),Store.limit(200)),
  snap=>onChange(snap.docs.map(d=>({id:d.id,...d.data()}))),onError);
}
export async function reviewVirtualPlanRequest(f,requestId,decision){
 if(!['approved','rejected'].includes(decision))throw new Error('Decisión no válida.');
 if(!/^[A-Za-z0-9]{15,40}$/.test(String(requestId)))throw new Error('Identificador no válido.');
 const {db,Store}=f,ref=Store.doc(db,'virtualPlanRequests',requestId);
 await Store.runTransaction(db,async tx=>{
  const snap=await tx.get(ref);
  if(!snap.exists())throw new Error('No se encontró la solicitud.');
  if(snap.data().status!=='pending')throw new Error('La solicitud ya fue revisada.');
  tx.update(ref,{status:decision,decisionAt:Store.serverTimestamp(),decidedBy:ADMIN_EMAIL});
 });
}
