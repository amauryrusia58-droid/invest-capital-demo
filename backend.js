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
 if(!user) user=(await Auth.signInAnonymously(auth)).user;
 if(!user.isAnonymous) throw new Error('Ya existe una sesión con Google en este navegador. Usa una ventana privada para la experiencia del alumno.');
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
