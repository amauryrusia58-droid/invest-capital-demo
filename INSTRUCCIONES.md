# Invest Capital V3.6 — cuatro planes y calculadora actualizada

## Qué cambia

- Se conserva el diseño negro, morado y dorado.
- La **portada** mantiene indicadores generales del caso, separados del historial de cada alumno.
- El **registro** admite nombre/identificador, grupo y correo electrónico opcional, con consentimiento académico explícito.
- El **alumno nuevo** empieza en $0, sin posiciones ni rendimientos previos.
- **Invertir** abre el panel de USDT (red BEP20), muestra la referencia **IC-DEMO-BEP20-001** y pide solamente un importe. Es una referencia artificial: **NO ES una dirección blockchain**. No permite enviar, recibir, ni conectar criptomonedas.
- Al introducir, por ejemplo, 100 USDT y hacer clic en **Registrar aporte**, se añade $100 de saldo virtual y una línea a movimientos.
- **Planes** permite asignar saldo a Essential (desde 100), Advanced (desde 300), Prime (desde 500) o Magnate Supremo (desde 1.000). La cartera refleja solamente las operaciones que hizo ese alumno.
- **Solicitar retiro** registra una solicitud virtual y descuenta el importe del saldo/posiciones mostrado. No envía ningún activo.
- **Administración**: con Firebase configurado, el docente puede consultar alias, actividad (incluidos aportes, planes y retiros) y modificar el escenario de toda la clase.

## Publicar en GitHub Pages

1. Descomprime el ZIP.
2. En el repositorio de Invest Capital, elige `Add file` → `Upload files`.
3. Sube **los 11 archivos de esta carpeta** directamente a la raíz del repositorio (no subas la carpeta ni el ZIP). Reemplaza los archivos existentes.
4. Haz clic en `Commit changes`.
5. Abre tu enlace de GitHub Pages y actualiza forzando recarga (`Ctrl + Shift + R`).
6. Pulsa **Registrarse**, crea una cuenta de prueba y haz el recorrido **Invertir → Registrar 100 USDT → Plan Essential → Asignar 100 USDT → Movimientos**.
7. Prueba **Solicitar retiro**.

## Notificaciones de nuevos registros

El registro intenta enviar un aviso a **investcapital8310@gmail.com** mediante `https://formsubmit.co/ajax/...` (servicio FormSubmit de terceros). Para recibir avisos debes **confirmar el correo receptor** si FormSubmit lo solicita; revisa spam/promociones. La respuesta de la API solo confirma que el servicio aceptó la solicitud: **no garantiza que el mensaje se haya entregado en Gmail**. Si la red o el servicio no funcionan, el registro local continúa. La plataforma no consulta ni verifica una bandeja de correo.

No se envían al servicio externo contraseñas, movimientos financieros ni datos bancarios. Se envían solamente los datos de registro, y el consentimiento lo explica. El correo del alumno es opcional.

## Panel del profesor en directo

**No está conectado automáticamente.** GitHub Pages no almacena por sí mismo datos centralizados. Para activarlo:

1. Crea un proyecto en https://console.firebase.google.com/ .
2. Habilita **Authentication → Sign-in method**: `Anonymous` (alumnos) y `Google` (administrador).
3. Habilita **Cloud Firestore**.
4. Copia de `Configuración del proyecto → Tus apps → Web` los campos públicos `apiKey`, `authDomain`, `projectId`, `appId` al archivo `firebase-config.js`.
5. En **Firestore Database → Rules**, pega y **publica** el contenido de `firestore.rules`.
6. En **Authentication → Settings → Authorized domains**, agrega el dominio de GitHub Pages que aloja el proyecto.
7. Recarga la página, registra un alumno de prueba y entra a `admin.html` con Google, usando **investcapital8310@gmail.com**. Verifica que el alumno y sus acciones aparezcan.
8. Comprueba la seguridad: otra cuenta Google debe tener el acceso al administrador denegado. La seguridad depende de las reglas Firestore publicadas, no de ocultar el enlace.

## Seguridad y límites

- `IC-DEMO-BEP20-001` no es una cartera cripto ni un identificador de una transacción real. **No la sustituyas por una cartera real** mientras la web se utilice en ejercicios públicos de alumnos.
- No se aceptan ni se procesan fondos; no se piden datos bancarios, contraseñas, frases semilla ni hashes de transacción.
- El aviso de simulación y el consentimiento se muestran antes de entrar; las conclusiones del caso no se revelan durante el recorrido.
- Sin Firebase, los movimientos se almacenan **solo en el navegador y dispositivo del alumno**. No aparecen en el panel remoto del profesor.
- El registro basado en alias no identifica de forma fehaciente a una persona y no debe utilizarse para evaluaciones de identidad, calificaciones oficiales o registros sensibles.


## Nueva calculadora y evolución del dashboard (V3.5)

- Nueva sección **Calculadora** en el menú del alumno y botón **Abrir calculadora** bajo los planes.
- Se introduce el plan, capital inicial y número entero de días, de 0 a 365. Presenta capital original, resultado hipotético, diferencia y días usados.
- Tasas **ilustrativas** de los planes: Essential 2,0 % semanal por 8 semanas; Advanced 3,5 % semanal por 12 semanas; Prime 5,0 % semanal por 16 semanas; Magnate Supremo 7,0 % semanal por 20 semanas.
- Cálculo sin reinversión: `ganancia = capital × tasa_semanal × min(días, semanas_plan×7) / 7`; `total = capital + ganancia`.
- En la **cuenta del alumno**, la ganancia de cada posición se calcula con los días completos transcurridos desde la fecha de asignación y se muestra al volver a abrir el dashboard. Para una posición nueva, empieza en $0 de ganancia. Las proyecciones se detienen al vencimiento del plan. La tabla de posiciones indica los días registrados.
- **Ejemplo:** 100 USDT, plan Essential, 30 días → ganancia estimada de 8,57 USDT; total de 108,57 USDT. El plazo de 8 semanas limita el máximo de ese plan.
- La calculadora no mueve fondos, no envía transacciones y no consulta datos externos. Los rendimientos son parte de la simulación académica, no ganancias reales ni garantizadas.
- La función de fases del profesor sigue afectando avisos y solicitudes de retiro, pero **ya no incrementa artificialmente las ganancias del alumno**. El crecimiento depende solo del capital, plan y días.
- El cambio no modifica los registros de alumnos existentes; las posiciones antiguas sin fecha técnica de creación utilizan la fecha legible del movimiento cuando se puede interpretar.

## V3.6 — cambios de planes

- Essential: mínimo 100 USDT, 2 % semanal, 8 semanas.
- Advanced: mínimo 300 USDT, 3,5 % semanal, 12 semanas.
- Prime: mínimo 500 USDT, 5 % semanal, 16 semanas.
- Magnate Supremo: mínimo 1.000 USDT, 7 % semanal, 20 semanas. Nombre deliberadamente humorístico para el ejercicio.
- La calculadora y los planes tienen los mismos porcentajes. Las posiciones ya abiertas que almacenaban una tasa conservan su tasa original, mientras que los nuevos planes usan las tasas V3.6.
- Tasas exageradas a propósito para el análisis crítico de esquemas Ponzi. Todos los saldos y rendimientos son hipotéticos y no respaldados por inversiones.
- La cartera de depósito sigue siendo `IC-DEMO-BEP20-001`, que no es una dirección BEP20 válida. No se habilitan transferencias.
