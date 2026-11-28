export function abrirDirectorio(firebase, endpoint) {
  const panel = document.getElementById('directorioSupabase');
  const lista = panel.querySelector('ul');
  const estado = panel.querySelector('[role=status]');
  const anterior = panel.querySelector('[data-anterior]');
  const siguiente = panel.querySelector('[data-siguiente]');
  const volver = panel.querySelector('[data-volver]');
  let paginaAlumnos = 1;
  let pagina = 1;
  let seleccionado = null;
  let version = 0;
  function boton(texto, accion) {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = texto; b.onclick = accion; return b;
  }
  async function cargar() {
    const turno = ++version;
    const url = new URL(endpoint);
    url.searchParams.set('pagina', pagina);
    if (seleccionado) url.searchParams.set('alumno', seleccionado.id);
    lista.replaceChildren(); siguiente.disabled = true; anterior.disabled = pagina === 1;
    volver.hidden = !seleccionado; estado.textContent = 'Cargando…';
    try {
      const token = await firebase.auth.currentUser.getIdToken();
      const resp = await fetch(url,{headers:{Authorization:'Bearer '+token},cache:'no-store'});
      if (!resp.ok) throw Error(resp.status === 401 || resp.status === 403 ? 'Vuelve a iniciar sesión con tu cuenta administradora.' : 'No se pudo cargar la página. Pulsa Actualizar.');
      const {rows, mas} = await resp.json();
      if (turno !== version) return;
      estado.textContent = seleccionado ? 'Solicitudes de '+seleccionado.correo : 'Cuentas registradas · Página '+pagina;
      if (!rows.length) estado.textContent += ' · Sin resultados';
      for (const fila of rows) {
        const li = document.createElement('li');
        if (seleccionado) li.textContent = [fila.tipo, fila.importe+' unidades', new Date(fila.creada).toLocaleString('es')].join(' · ');
        else {
          li.textContent = [fila.nombre,fila.correo,fila.confirmada?'Confirmada':'Pendiente de confirmación'].filter(Boolean).join(' · ')+' ';
          li.append(boton('Ver solicitudes',()=>{ paginaAlumnos=pagina; seleccionado=fila; pagina=1; cargar(); }));
        }
        lista.append(li);
      }
      siguiente.disabled = !mas;
    } catch (error) { if (turno === version) estado.textContent = error.message; }
  }
  volver.onclick=()=>{seleccionado=null;pagina=paginaAlumnos;cargar();};
  anterior.onclick=()=>{if(pagina>1){pagina--;cargar();}};
  siguiente.onclick=()=>{pagina++;cargar();};
  panel.querySelector('[data-recargar]').onclick=cargar;
  cargar();
}