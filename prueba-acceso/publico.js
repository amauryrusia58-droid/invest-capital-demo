(async () => {
  const id = name => document.getElementById(name);
  const form = id('form');
  const fields = form.elements;
  const status = message => { id('status').textContent = message; };
  const titles = { signup: 'Crear cuenta', login: 'Iniciar sesión', confirm: 'Confirmar correo' };
  let mode;
  function show(next) {
    mode = next;
    id('title').textContent = titles[next];
    id('profile').hidden = true;
    form.hidden = false;
    id('nav').hidden = false;
    for (const [field, label, active] of [
      ['name','nameLabel',next === 'signup'], ['password','passLabel',next !== 'confirm'],
      ['token','codeLabel',next === 'confirm']
    ]) {
      fields[field].disabled = id(label).hidden = !active;
      fields[field].required = active;
    }
    fields.password.value = fields.token.value = '';
    fields.password.autocomplete = next === 'signup' ? 'new-password' : 'current-password';
    fields.password.minLength = next === 'signup' ? 8 : 1;
    id('submit').textContent = titles[next];
    status('');
  }
  function profile(user) {
    if (!user?.email_confirmed_at) throw Error('Confirma tu correo para abrir el perfil.');
    form.reset();
    id('nav').hidden = form.hidden = true;
    id('profile').hidden = false;
    id('title').textContent = 'Mi perfil';
    id('name').textContent = user.user_metadata?.registro_nombre || user.user_metadata?.full_name || '';
    id('email').textContent = user.email;
    status('');
  }
  const message = error => ({
    invalid_credentials: 'Revisa el correo y la contraseña.',
    otp_expired: 'El código ha vencido o es incorrecto.',
    over_email_send_rate_limit: 'Espera unos minutos antes de solicitar otro correo.',
    weak_password: 'Elige una contraseña más larga y difícil de adivinar.'
  }[error?.code] || 'No se pudo completar la operación. Comprueba la conexión. Si ya solicitaste el registro, revisa tu correo antes de repetirlo.');
  try {
    const cfg = window.INVEST_DEMO_CONFIG;
    const auth = window.supabase.createClient(cfg.supabaseUrl, cfg.publishableKey, {
      auth: { storageKey: 'invest-capital-prueba-publica' }
    }).auth;
    const initial = await auth.getSession();
    if (initial.error) throw initial.error;
    if (initial.data.session) {
      const result = await auth.getUser();
      if (result.error) throw result.error;
      profile(result.data.user);
    } else show('login');
    document.querySelectorAll('[data-mode]').forEach(button => {
      button.onclick = () => show(button.dataset.mode);
    });
    form.onsubmit = async event => {
      event.preventDefault();
      if (id('submit').disabled) return;
      const buttons = [...document.querySelectorAll('button')];
      buttons.forEach(b => { b.disabled = true; });
      const email = fields.email.value.trim();
      const password = fields.password.value;
      status('Conectando…');
      try {
        let result;
        if (mode === 'signup') {
          const name = fields.name.value.trim();
          if (!name) { status('Escribe tu nombre.'); return; }
          result = await auth.signUp({ email, password, options: {
            emailRedirectTo: location.origin + location.pathname,
            data: { registro_nombre: name }
          }});
          if (!result.error && !result.data.session) {
            show('confirm');
            status('Revisa tu correo. Si recibiste un enlace, ábrelo. Si recibiste un código, introdúcelo aquí.');
            return;
          }
        } else if (mode === 'confirm') {
          result = await auth.verifyOtp({ email, token: fields.token.value.trim(), type: 'email' });
        } else {
          result = await auth.signInWithPassword({ email, password });
        }
        if (result.error?.code === 'email_not_confirmed') {
          show('confirm'); status('Confirma tu correo con el mensaje de Supabase.'); return;
        }
        if (result.error) throw result.error;
        profile(result.data.user);
      } catch (error) { status(message(error)); }
      finally { buttons.forEach(b => { b.disabled = false; }); }
    };
    id('out').onclick = async () => {
      try {
        const {error} = await auth.signOut({scope:'local'});
        if (error) throw error;
        id('name').textContent = id('email').textContent = '';
        show('login');
      } catch (error) { status(message(error)); }
    };
  } catch { id('nav').hidden = true; status('No se pudo abrir el acceso. Comprueba la conexión y vuelve a cargar esta página.'); }
})();
