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
