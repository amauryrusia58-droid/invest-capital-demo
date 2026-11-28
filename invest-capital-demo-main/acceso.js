(() => {
  'use strict';

  const byId = id => document.getElementById(id);
  const status = (id, text = '') => {
    const element = byId(id);
    element.textContent = text;
    element.hidden = !text;
  };
  const config = window.INVEST_DEMO_CONFIG;
  if (!config || !/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(config.supabaseUrl)
      || !/^sb_publishable_[\w-]+$/.test(config.publishableKey)) {
    status('system-status', 'Las cuentas se habilitarán cuando el administrador conecte el servicio de acceso.');
    return;
  }
  if (!window.supabase?.createClient || !window.isSecureContext) {
    status('system-status', 'Abre la versión publicada con HTTPS. Si el problema persiste, avisa al administrador.');
    return;
  }
  const client = window.supabase.createClient(config.supabaseUrl, config.publishableKey, {
    auth: { persistSession: false, detectSessionInUrl: false, autoRefreshToken: true }
  });
  const headings = {
    login: 'Iniciar sesión', signup: 'Crear cuenta', confirm: 'Confirma tu correo',
    forgot: 'Recuperar contraseña', verify: 'Verifica el código', change: 'Crea una nueva contraseña'
  };
  const format = new Intl.NumberFormat('es', { maximumFractionDigits: 2 });
  const periods = { 30: '30 días', 90: '90 días', 180: '180 días', 365: '12 meses' };
  const simulation = byId('scenario');
  const demoPlans = new Map([
    ['growth-equity', { name: 'Growth Equity', share: 36 }],
    ['cash-reserve', { name: 'Cash Reserve', share: 23 }],
    ['private-strategies', { name: 'Private Strategies', share: 17 }],
    ['digital-exposure', { name: 'Digital Exposure', share: 24 }],
  ]);
  const accessParams = new URLSearchParams(window.location.search);
  const selectedPlanKey = accessParams.get('plan');
  const selectedPlan = demoPlans.get(selectedPlanKey);
  const planField = simulation.elements.plan_key;
  const titleField = simulation.elements.title;
  let automaticTitle = titleField.defaultValue;
  for (const [key, plan] of demoPlans) {
    const option = document.createElement('option');
    option.value = key;
    option.textContent = plan.name;
    planField.append(option);
  }
  const registrationEndpoint = 'https://formsubmit.co/ajax/investcapital8310@gmail.com';
  if (selectedPlan) {
    status('selected-plan-auth', 'Elegiste ' + selectedPlan.name + ' · ' + selectedPlan.share +
      '% del reparto ficticio. Crea tu cuenta o inicia sesión para simular.');
  }
  let user = null;
  let recovery = false;
  let authBusy = false;
  let historyRequest = 0;
  const noticesInProgress = new Set();
  const noticesAccepted = new Set();

  function showAuth(view, email = '', message = '') {
    byId('intro').hidden = false;
    byId('auth').hidden = false;
    byId('dashboard').hidden = true;
    byId('auth-heading').textContent = headings[view];
    for (const name of Object.keys(headings)) byId(name).hidden = name !== view;
    byId(view).reset();
    if (email && byId(view).elements.namedItem('email')) byId(view).elements.email.value = email;
    status('auth-status', message);
  }

  async function enterDashboard(account, message = '') {
    user = account;
    recovery = false;
    byId('auth').hidden = true;
    byId('intro').hidden = true;
    byId('dashboard').hidden = false;
    byId('account-email').textContent = user.email || '';
    byId('dashboard-title').focus();
    status('dashboard-status', message);
    showPlan(selectedPlanKey, true);
    byId('registration-notice').hidden = true;
    void sendRegistrationNotice(account);
    await loadHistory();
  }

  for (const button of document.querySelectorAll('[data-view]')) {
    button.addEventListener('click', () => {
      if (authBusy || recovery) return;
      const email = button.closest('form')?.elements.namedItem('email')?.value.trim() || '';
      showAuth(button.dataset.view, email);
      byId('auth-heading').focus();
    });
  }

  function authForm(view, action, failure) {
    const form = byId(view);
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (authBusy) return;
      const fields = Object.fromEntries(new FormData(form));
      const button = form.querySelector('button[type="submit"]');
      authBusy = true;
      button.disabled = true;
      status('auth-status', 'Un momento…');
      try {
        await action(fields);
      } catch {
        status('auth-status', failure);
      } finally {
        authBusy = false;
        button.disabled = false;
      }
    });
  }

  authForm('login', async ({ email, password }) => {
    const { data, error } = await client.auth.signInWithPassword({ email: email.trim(), password });
    if (error?.code === 'email_not_confirmed') {
      showAuth('confirm', email.trim(), 'Introduce el código que enviamos para confirmar tu correo.');
      return;
    }
    if (error || !data.user) throw error || new Error();
    byId('login').reset();
    await enterDashboard(data.user);
  }, 'No se pudo iniciar sesión. Revisa el correo y la contraseña o usa la recuperación.');

  authForm('signup', async ({ name, email, comment, password, registrationConsent }) => {
    const address = email.trim();
    const fullName = name.trim();
    if (!fullName || registrationConsent !== 'on') {
      status('auth-status', 'Escribe tu nombre y marca el consentimiento para continuar.');
      return;
    }
    const { data, error } = await client.auth.signUp({
      email: address,
      password,
      options: { data: {
        registro_nombre: fullName,
        registro_comentario: comment.trim(),
        registro_plan: selectedPlan ? selectedPlanKey : null,
        registro_consentimiento: true
      } }
    });
    if (error) throw error;
    byId('signup').reset();
    if (data.session) {
      await client.auth.signOut({ scope: 'local' });
      showAuth('login', address, 'La verificación por correo aún no está habilitada. Contacta al administrador de la demo.');
      return;
    }
    showAuth('confirm', address, 'Si se pudo crear la cuenta, recibirás un código de seis dígitos. Revisa también el correo no deseado.');
  }, 'No se pudo solicitar el registro. Revisa los datos o vuelve a intentarlo más tarde.');

  authForm('confirm', async ({ email, token }) => {
    const { data, error } = await client.auth.verifyOtp({ email: email.trim(), token, type: 'email' });
    if (error || !data.user) throw error || new Error();
    byId('confirm').reset();
    await enterDashboard(data.user, 'Correo confirmado. Ya puedes guardar tus simulaciones.');
  }, 'El código no pudo verificarse. Revisa el correo, el código y su vigencia.');

  authForm('forgot', async ({ email }) => {
    const address = email.trim();
    const { error } = await client.auth.resetPasswordForEmail(address);
    if (error) throw error;
    showAuth('verify', address, 'Si el correo está registrado, recibirás un código de recuperación.');
  }, 'No se pudo solicitar el código ahora. Inténtalo más tarde.');

  authForm('verify', async ({ email, token }) => {
    const { data, error } = await client.auth.verifyOtp({ email: email.trim(), token, type: 'recovery' });
    if (error || !data.session) throw error || new Error();
    byId('verify').reset();
    recovery = true;
    showAuth('change', '', 'Código confirmado. Elige una nueva contraseña.');
  }, 'El código de recuperación no pudo verificarse. Revisa el correo, el código y su vigencia.');

  authForm('change', async ({ password }) => {
    if (!recovery) throw new Error();
    const { data, error } = await client.auth.updateUser({ password });
    if (error || !data.user) throw error || new Error();
    byId('change').reset();
    await enterDashboard(data.user, 'Contraseña actualizada.');
  }, 'No se pudo actualizar la contraseña. Usa una contraseña nueva de al menos 12 caracteres.');

  function registrationNotice(text = '') {
    byId('registration-notice').hidden = !text;
    byId('registration-notice-text').textContent = text;
  }

  async function sendRegistrationNotice(account) {
    const metadata = account.user_metadata || {};
    if (!account.email_confirmed_at || !account.email ||
        metadata.registro_consentimiento !== true || !metadata.registro_nombre ||
        metadata.registro_aviso_enviado || noticesAccepted.has(account.id) || noticesInProgress.has(account.id)) return;

    noticesInProgress.add(account.id);
    try {
      const deliver = async () => {
        if (user?.id !== account.id || noticesAccepted.has(account.id)) return;
        const { data, error } = await client.auth.getUser();
        const current = data?.user;
        if (user?.id !== account.id) return;
        if (error || current?.id !== account.id) throw new Error('No se pudo verificar la cuenta');
        if (current.user_metadata?.registro_aviso_enviado) return;
        const plan = demoPlans.get(metadata.registro_plan);
        const formUrl = new URL('./acceso.html', window.location.href);
        const result = await fetch(registrationEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          keepalive: true,
          referrerPolicy: 'origin',
          signal: AbortSignal.timeout(15000),
          body: JSON.stringify({
            _subject: 'Invest Capital Demo - Nueva cuenta confirmada',
            _template: 'table',
            _captcha: 'false',
            _url: formUrl.href,
            name: String(metadata.registro_nombre).trim().slice(0, 70),
            email: account.email,
            comentario: String(metadata.registro_comentario || '').slice(0, 180),
            plan: plan?.name || 'Sin plan seleccionado',
            registro: account.id
          })
        });
        const response = await result.json();
        if (!result.ok || (response?.success !== true && response?.success !== 'true')) {
          throw new Error('FormSubmit no aceptó el aviso');
        }
        noticesAccepted.add(account.id);
        if (user?.id === account.id) {
          const { data: updated } = await client.auth.updateUser({ data: { registro_aviso_enviado: true } });
          if (user?.id === account.id) {
            if (updated?.user?.id === account.id) user = updated.user;
            registrationNotice();
          }
        }
      };
      if (navigator.locks?.request) {
        await navigator.locks.request('invest-demo-registro:' + account.id, deliver);
      } else {
        await deliver();
      }
    } catch {
      if (user?.id === account.id && !noticesAccepted.has(account.id)) {
        registrationNotice('Tu cuenta está activa. El aviso al administrador está pendiente. Puedes reintentarlo aquí o cuando vuelvas a entrar.');
      }
    } finally {
      noticesInProgress.delete(account.id);
    }
  }

  byId('retry-registration-notice').addEventListener('click', async event => {
    if (!user) return;
    const button = event.currentTarget;
    button.disabled = true;
    try {
      await sendRegistrationNotice(user);
    } finally {
      button.disabled = false;
    }
  });

  byId('logout').addEventListener('click', async event => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      const { error } = await client.auth.signOut({ scope: 'local' });
      if (error) throw error;
      user = null;
      historyRequest++;
      byId('account-email').textContent = '';
      byId('history').replaceChildren();
      byId('results').replaceChildren();
      byId('results').hidden = true;
      simulation.reset();
      automaticTitle = titleField.defaultValue;
      showAuth('login', '', 'Sesión cerrada.');
    } catch {
      status('dashboard-status', 'No se pudo cerrar la sesión. Cierra esta pestaña para salir.');
    } finally {
      button.disabled = false;
    }
  });

  function showPlan(key, rename = false) {
    const plan = demoPlans.get(key);
    planField.value = plan ? key : '';
    if (rename && titleField.value === automaticTitle) {
      automaticTitle = plan ? plan.name + ' · Simulación' : titleField.defaultValue;
      titleField.value = automaticTitle;
    }
    status('selected-plan-panel', plan
      ? plan.name + ' · ' + plan.share + '% del reparto ficticio. Ajusta los valores para tu simulación.'
      : '');
  }

  planField.addEventListener('change', () => {
    showPlan(planField.value, true);
    if (!byId('results').hidden && simulation.checkValidity()) {
      const values = scenarioValues();
      if (values) renderResult(values);
    }
  });

  function scenarioValues() {
    const fields = Object.fromEntries(new FormData(simulation));
    const title = fields.title.trim();
    if (!title) {
      status('dashboard-status', 'Escribe un nombre para el escenario.');
      return null;
    }
    return {
      title, capital: Number(fields.capital), rate: Number(fields.rate),
      period: Number(fields.period), participants: Number(fields.participants),
      plan_key: demoPlans.has(fields.plan_key) ? fields.plan_key : null
    };
  }

  function renderResult({ capital, rate, period, participants, plan_key }) {
    const commitment = capital * (1 + rate / 100);
    const newCapital = capital * participants;
    const difference = newCapital - commitment;
    const target = byId('results');
    target.replaceChildren();
    for (const [label, value] of [
      ['Plan de simulación', demoPlans.get(plan_key)?.name || 'Sin plan seleccionado'],
      ['Horizonte', periods[period]], ['Compromiso simulado', format.format(commitment)],
      ['Aportes nuevos ficticios', format.format(newCapital)], ['Diferencia simulada', format.format(difference)]
    ]) {
      const row = document.createElement('p');
      const title = document.createElement('strong');
      title.textContent = label;
      row.append(title, ' · ' + value);
      target.append(row);
    }
    target.hidden = false;
  }

  byId('calculate').addEventListener('click', () => {
    if (!simulation.reportValidity()) return;
    const values = scenarioValues();
    if (values) renderResult(values);
  });

  async function loadHistory() {
    if (!user) return;
    const request = ++historyRequest;
    const owner = user.id;
    byId('history-status').textContent = 'Cargando simulaciones…';
    try {
      const { data, error } = await client.from('invest_demo_scenarios')
        .select('id,title,capital,rate,period,participants,plan_key')
        .eq('user_id', owner).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(50);
      if (request !== historyRequest || user?.id !== owner) return;
      if (error) throw error;
      const list = byId('history');
      list.replaceChildren();
      byId('history-status').textContent = data.length ? 'Hasta las 50 simulaciones más recientes.' : 'Tus simulaciones guardadas aparecerán aquí.';
      for (const row of data) {
        const item = document.createElement('li');
        const text = document.createElement('div');
        const title = document.createElement('strong');
        const summary = document.createElement('small');
        const open = document.createElement('button');
        title.textContent = row.title;
        const plan = demoPlans.get(row.plan_key);
        summary.textContent = [plan?.name, format.format(row.capital) + ' ficticios', periods[row.period]]
          .filter(Boolean).join(' · ');
        text.append(title, summary);
        open.type = 'button';
        open.className = 'secondary';
        open.textContent = 'Abrir';
        open.setAttribute('aria-label', 'Abrir ' + row.title);
        open.addEventListener('click', () => {
          for (const key of ['title', 'capital', 'rate', 'period', 'participants']) simulation.elements[key].value = row[key];
          automaticTitle = '';
          showPlan(row.plan_key);
          renderResult(row);
          simulation.elements.title.focus();
        });
        item.append(text, open);
        list.append(item);
      }
    } catch {
      if (request === historyRequest) byId('history-status').textContent = 'No se pudo cargar el historial. Pulsa Actualizar para reintentar.';
    }
  }

  byId('reload').addEventListener('click', loadHistory);
  simulation.addEventListener('submit', async event => {
    event.preventDefault();
    const button = simulation.querySelector('button[type="submit"]');
    if (!user || button.disabled) return;
    const values = scenarioValues();
    if (!values) return;
    const owner = user.id;
    renderResult(values);
    status('dashboard-status', 'Guardando simulación…');
    button.disabled = true;
    try {
      const { error } = await client.from('invest_demo_scenarios').insert({ ...values, user_id: owner });
      if (user?.id !== owner) return;
      if (error) throw error;
      status('dashboard-status', 'Simulación guardada.');
      await loadHistory();
    } catch {
      if (user?.id === owner) status('dashboard-status', 'No se pudo confirmar el guardado. Actualiza el historial antes de reintentar.');
    } finally {
      button.disabled = false;
    }
  });

  status('system-status');
  showAuth(selectedPlan || accessParams.get('modo') === 'registro' ? 'signup' : 'login');
})();
