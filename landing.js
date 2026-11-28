const $ = id => document.getElementById(id);
const { supabaseUrl, publishableKey } = window.INVEST_DEMO_CONFIG;
const { auth } = window.supabase.createClient(supabaseUrl, publishableKey);
const accountUrl = new URL('cuenta.html', location.href);
function show(login) {
  $('consent').classList.toggle('hidden', login);
  $('loginOverlay').classList.toggle('hidden', !login);
  $('loginError').textContent = $('consentError').textContent = '';
  $(login ? 'loginEmail' : 'studentName').focus();
}
function closeDialogs() {
  $('consent').classList.add('hidden');
  $('loginOverlay').classList.add('hidden');
}
for (const id of ['openRegister','startBtn','bottomBtn']) $(id).onclick = () => {
  sessionStorage.removeItem('ic_selected_plan');
  show(false);
};
for (const card of document.querySelectorAll('[data-public-plan]')) card.onclick = () => {
  sessionStorage.setItem('ic_selected_plan', card.dataset.publicPlan);
  show(false);
};
$('openApp').onclick = $('goLogin').onclick = () => show(true);
$('goRegister').onclick = () => show(false);
$('cancelBtn').onclick = $('cancelLogin').onclick = closeDialogs;
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDialogs(); });
for (const id of ['consent','loginOverlay']) $(id).onclick = e => { if (e.target === $(id)) closeDialogs(); };
function bind(id, button, output, action) {
  $(id).onsubmit = async event => {
    event.preventDefault();
    if ($(button).disabled || !$(id).reportValidity()) return;
    $(button).disabled = true;
    $(output).textContent = 'Conectando…';
    try { await action(); }
    catch (error) { $(output).textContent = error.message || 'No se pudo completar la operación.'; }
    finally { $(button).disabled = false; }
  };
}
function confirmEmail(email) {
  sessionStorage.setItem('ic_confirm_email', email);
  location.assign(accountUrl.href + '?paso=confirmar');
}
bind('registrationForm','acceptBtn','consentError', async () => {
  const name = $('studentName').value.trim();
  const email = $('studentEmail').value.trim();
  const password = $('studentPassword').value;
  if (name.split(/\s+/).length < 2) throw Error('Escribe tu nombre y apellidos.');
  if (password !== $('studentPasswordConfirm').value) throw Error('Las contraseñas deben coincidir.');
  const { data, error } = await auth.signUp({ email, password, options: {
    emailRedirectTo: accountUrl.href,
    data: { registro_nombre: name, referido: $('studentReferral').value.trim() }
  }});
  if (error) throw error;
  $('registrationForm').reset();
  if (data.session) location.assign(accountUrl.href);
  else confirmEmail(email);
});
bind('loginForm','submitLogin','loginError', async () => {
  const email = $('loginEmail').value.trim();
  const { error } = await auth.signInWithPassword({ email, password: $('loginPassword').value });
  if (error?.code === 'email_not_confirmed') return confirmEmail(email);
  if (error) throw error;
  location.assign(accountUrl.href);
});
$('resetPassword').onclick = async () => {
  const field = $('loginEmail');
  if (!field.reportValidity() || !field.value.trim()) return;
  $('resetPassword').disabled = true;
  try {
    const { error } = await auth.resetPasswordForEmail(field.value.trim(), { redirectTo: accountUrl.href + '?paso=recuperar' });
    if (error) throw error;
    sessionStorage.setItem('ic_confirm_email', field.value.trim());
    location.assign(accountUrl.href + '?paso=codigo-recuperacion');
  } catch (error) { $('loginError').textContent = error.message; }
  finally { $('resetPassword').disabled = false; }
};
if (new URLSearchParams(location.search).get('login') === '1') show(true);
