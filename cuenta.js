const $ = id => document.getElementById(id);
const cfg = window.INVEST_DEMO_CONFIG;
const { auth } = window.supabase.createClient(cfg.supabaseUrl, cfg.publishableKey);
const step = new URLSearchParams(location.search).get('paso');
function view(id, title, status = '') {
  for (const section of ['verify','change','profile']) $(section).hidden = section !== id;
  $('title').textContent = title;
  $('status').textContent = status;
}
async function authenticated() {
  const { data, error } = await auth.getUser();
  if (error || !data.user?.email_confirmed_at) throw Error('Inicia sesión de nuevo para ver tu perfil.');
  $('name').textContent = data.user.user_metadata?.registro_nombre || '';
  $('email').textContent = data.user.email;
  view('profile','Mi perfil');
}
function submit(id, action) {
  $(id).onsubmit = async event => {
    event.preventDefault();
    const btn = $(id).querySelector('button');
    if (btn.disabled) return;
    btn.disabled = true;
    try { await action($(id).elements); }
    catch (error) { $('status').textContent = error.message; }
    finally { btn.disabled = false; }
  };
}
submit('verify', async fields => {
  const recovery = step === 'codigo-recuperacion';
  const { error } = await auth.verifyOtp({ type: recovery ? 'recovery' : 'email', email: fields.email.value.trim(), token: fields.token.value.trim() });
  if (error) throw error;
  sessionStorage.removeItem('ic_confirm_email');
  $('verify').reset();
  if (recovery) view('change','Cambiar contraseña');
  else await authenticated();
});
submit('change', async fields => {
  const { error } = await auth.updateUser({ password: fields.password.value });
  if (error) throw error;
  $('change').reset();
  history.replaceState(null,'',location.pathname);
  await authenticated();
});
$('logout').onclick = async () => {
  try {
    const { error } = await auth.signOut({scope:'local'});
    if (error) throw error;
    location.replace('index.html?login=1');
  } catch (error) { $('status').textContent = error.message; }
};
try {
  const { data, error } = await auth.getSession();
  if (error) throw error;
  if (step === 'codigo-recuperacion' || step === 'confirmar') {
    $('verify').elements.email.value = sessionStorage.getItem('ic_confirm_email') || '';
    view('verify','Revisa tu correo','Abre el enlace recibido o introduce el código de tu correo.');
  } else if (step === 'recuperar' && data.session) view('change','Cambiar contraseña');
  else await authenticated();
} catch (error) { view(null,'Acceso de usuarios',error.message); }
