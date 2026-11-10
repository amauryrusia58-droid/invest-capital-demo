# Invest Capital V3.3 — Registro de alumnos

**Cambio principal:** ahora se ven dos botones en la portada: **Registrarse** y **Acceder**. El registro abre un formulario con nombre o identificador (obligatorio), correo y grupo (opcionales), y consentimiento académico. Ningún alumno debe dar contraseñas, datos bancarios ni enviar dinero.

El botón **Acceder** reabre la sesión ya creada en el mismo navegador. Como se utiliza Firebase anónimo, **no es una cuenta permanente entre dispositivos**; si se cambia de equipo hay que volver a registrarse. Para compartir un equipo, hay que pulsar **Cerrar sesión** antes de que entre otro alumno.

**Seguimiento:** para que el profesor vea nombres, grupos, correos opcionales y acciones desde otro equipo, es imprescindible activar Firebase, configurar `firebase-config.js`, habilitar inicio anónimo, configurar Firestore y **publicar las nuevas reglas `firestore.rules`**. Con GitHub Pages sin Firebase, los datos solo permanecen en ese navegador. Los correos se guardan como información *declarada*, no verificada.

**IMPORTANTE PARA QUIEN YA USA FIREBASE:** la versión V3.3 introduce los campos `email` y `group` en la colección `sessions`; hay que actualizar las reglas de Firestore ANTES de probar nuevos registros. Registros de versiones anteriores se siguen mostrando.

**Publicación:** descarga y descomprime el ZIP, sube **todos los archivos** de su interior a la raíz del repositorio de GitHub Pages y confirma con Commit changes. Después recarga con `Ctrl + Shift + R`. Prueba Registrarse y Acceder.

---

# Invest Capital V3.2 — Negro, morado y dorado

**Rediseño completo de color y jerarquía visual** en portada `index.html`, panel `app.html` y consola `admin.html`.

# Invest Capital — instalación y panel privado del docente

**Versión:** 3.1 revisada — escenario financiero interactivo para proyección en clase.

## Qué contiene este paquete

- `index.html` — portada financiera rediseñada, con botón verde oscuro y texto blanco.
- `app.html` / `app.js` — plataforma interactiva: cartera, planes, movimientos, asociados, documentos y soporte.
- `admin.html` / `admin.js` — consola privada del profesor; muestra alumnos por alias, sus acciones, solicitudes de retiro por alumno seleccionado, exportación CSV y controla cuatro escenarios para toda la clase.
- `styles.css` — diseño adaptable a pantallas grandes y móviles.
- `backend.js` — conexión opcional con Firebase Authentication y Firestore.
- `firebase-config.js` — configuración **pública** del proyecto Firebase y dirección de correo del profesor.
- `firestore.rules` — normas de seguridad para proteger la actividad de los alumnos.

## 1. Publicar en GitHub Pages

1. Descomprime el ZIP.
2. En el repositorio actual de Invest Capital, **haz una copia de tu `index.html` anterior**.
3. Sube los archivos de esta carpeta **a la raíz del repositorio**, incluido `index.html`. No subas solo el ZIP o una carpeta contenedora.
4. Pulsa **Commit changes**.
5. Si GitHub Pages ya está activo, visita la URL actual de tu sitio. Si ves una versión antigua, pulsa `Ctrl + Shift + R` para renovar la caché.
6. En la portada pulsa **Explorar plataforma**, acepta el contexto académico y escribe un alias. No se pide ninguna contraseña.

## 2. Configurar el panel privado para recibir actividad

**Importante:** GitHub Pages solo publica archivos estáticos. **El seguimiento en directo NO funcionará hasta configurar Firebase y publicar las reglas.** No basta con escribir el correo del administrador en el código.

1. Abre <https://console.firebase.google.com/> y crea un proyecto Firebase gratuito, por ejemplo `invest-capital-aula`. Revisa los límites vigentes del plan antes de usarlo con muchos alumnos.
2. En el proyecto pulsa `Agregar aplicación` → icono **Web** (</>) y registra la aplicación. Copia los datos de configuración web (`apiKey`, `authDomain`, `projectId`, `appId`). Son identificadores públicos, NO credenciales secretas.
3. En el archivo `firebase-config.js` rellena **únicamente** esos cuatro campos. **NO** pegues contraseñas, tokens, archivos JSON de cuentas de servicio ni claves privadas.
4. En **Authentication → Sign-in method**, habilita **Anonymous** (para los alumnos, que usan alias) y **Google** (solo el profesor accede a la consola). En **Authentication → Settings → Authorized domains**, añade el dominio donde esté publicada la web, por ejemplo `usuario.github.io`, sin `https://` ni ruta.
5. En **Firestore Database** crea la base de datos en modo de producción. Abre **Rules**, sustituye el contenido por todo el texto de `firestore.rules` y pulsa **Publish**. No utilices reglas generales `allow read, write: if true;`.
6. Publica en GitHub Pages el `firebase-config.js` ya completado, junto con los demás archivos. **No publiques `firestore.rules` como única forma de aplicar permisos**: las reglas deben copiarse y publicarse dentro de Firebase.
7. En la web abre `https://TU-SITIO/admin.html`, pulsa **Acceder con Google** y elige la cuenta **investcapital8310@gmail.com**. La consola rechaza otras cuentas.
8. En otro navegador o una ventana privada, abre la portada para entrar como alumno con un alias. Al tocar secciones, consultar documentos o solicitar retiros aparecerán los eventos en el panel del profesor. Puedes escoger escenarios (1–4) y ver cómo se reflejan en los paneles conectados.

## 3. Privacidad y límites del ejercicio

- Hay **un aviso de participación académica antes de entrar**. No aparecen cuestionarios ni mensajes que resuelvan el ejercicio al alumno. El pie de página conserva una indicación discreta de que no hay fondos reales.
- Las cifras son **inventadas**. La interfaz no incluye wallets, transferencias, tarjetas, pagos, recaudación ni cuentas bancarias.
- Se recopilan únicamente el **alias** y las acciones aceptadas (secciones abiertas, planes vistos, intentos de añadir capital, intentos de retirar, documentos, motivo de soporte). El texto libre de consultas **no** se envía a la base de datos.
- El acceso y las reglas de Firebase permiten al alumno leer solo sus propios registros. El docente puede consultar el conjunto de alumnos y sus eventos. Las normas deben publicarse para que esto tenga efecto.
- La cuenta del alumno es anónima; si borra datos del navegador o utiliza otro dispositivo, recibirá una nueva sesión. En equipos compartidos pulsa **Cerrar sesión** para iniciar con otro alias.
- El control de escenarios afecta al conjunto de la clase: 1. operación habitual; 2. mayor rentabilidad anunciada; 3. demoras; 4. suspensión.
- No es una reproducción ni afiliación de Trust Investing. Es un caso ficticio de estudio inspirado en mecanismos de riesgo observados en plataformas históricas.
- Para usar con estudiantes menores de edad, respeta el consentimiento y la política de privacidad aplicable al centro; no uses nombres completos ni datos personales como alias.

## 4. Acceso al profesor y problemas habituales

- **Dirección del profesor:** `investcapital8310@gmail.com` está escrita en `firebase-config.js` y en `firestore.rules`. Si se cambia, hay que actualizar **ambos**.
- **La consola dice que falta Firebase:** rellena los cuatro campos de `firebase-config.js`, vuelve a subir ese archivo y actualiza la web.
- **La consola dice `permission-denied`:** verifica que publicaste `firestore.rules`, habilitaste Google y entraste con la cuenta autorizada.
- **El inicio de sesión dice `auth/unauthorized-domain`:** autoriza `usuario.github.io` en Authentication → Settings → Authorized domains.
- **Ningún alumno aparece:** habilita Anonymous en Authentication, crea Firestore y comprueba que el alumno aceptó el aviso al iniciar. Las ventanas privadas evitan reutilizar una sesión del profesor.
- **La portada sigue igual:** revisa que `index.html` se subió directamente a la raíz, haz `Commit changes` y fuerza actualización con `Ctrl + Shift + R`.
- **No abras los archivos con doble clic** si quieres probar módulos de JavaScript: usa GitHub Pages o un servidor local; el protocolo `file://` puede bloquear las importaciones.

## Seguridad

El correo incluido en los archivos NO es una contraseña. Las verificaciones se hacen mediante la cuenta Google autenticada y las reglas de seguridad de Firestore. No modifiques las reglas para dar acceso de lectura a todo el mundo. Antes de proyectar la clase, verifica con otra cuenta de Google que la página `/admin.html` rechaza el acceso.

## 5. Revisión técnica de esta entrega (V3.1)

- Verificados los 11 archivos del paquete original y sus referencias internas.
- Revisada la sintaxis de todos los módulos JavaScript.
- Corregido el registro de acciones: los primeros clics se ponen en cola hasta establecer la sesión; las escrituras de evento y resumen son atómicas. Si falla la red, el panel indica que quedan acciones pendientes y vuelve a intentar en otra interacción. **No es una cola persistente**: cerrar la pestaña durante un fallo puede hacer perder eventos pendientes.
- Corregido el indicador de retiros del profesor: ahora cuenta eventos `withdraw_attempt` del alumno seleccionado y de los **últimos 200 eventos cargados**, en vez de deducirlo de la última acción de todas las sesiones.
- La vista local sigue siendo exploratoria y los datos no se sincronizan con el docente hasta completar Firebase.
- No se ha probado una conexión con un proyecto Firebase real, porque esta entrega no incluye credenciales públicas de ese proyecto. Prueba la autenticación y las reglas antes de la clase.


## Cambios de diseño V3.2

- Negro profundo como fondo, morado amatista en paneles y botones, oro champán para acentos y datos destacados.
- Gráficas violetas y doradas (sin verde ni turquesa), tarjetas de activos con acabado oscuro y barra lateral morada.
- Botones morados con texto blanco de alto contraste.
- Se conserva el aviso académico previo a la entrada. No se aceptan pagos, contraseñas ni datos bancarios.
- Firebase sigue requiriendo configuración para que la consola privada muestre actividad de otros dispositivos.
