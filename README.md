# Invest Capital — edición Aula de Inversiones

Paquete estático para GitHub Pages. Incluye la portada reciente (`index.html`) y tres páginas de práctica (`acceso.html`, `panel.html`, `aula.html`) con una hoja de estilos compartida (`estilo.css`).

## Propósito
Caso educativo para que estudiantes detecten señales de una posible estafa piramidal o Ponzi **por su propio análisis**. Presenta una interfaz financiera verosímil, aunque identificada como simulación académica. **No se deben quitar las etiquetas que señalan que es una práctica ni convertir el entorno en una captación real de dinero.**

## Cómo instalar en GitHub Pages
1. Abre el repositorio de tu Invest Capital.
2. Sube estos cinco archivos a la carpeta donde está el `index.html` publicado. Sustituye **solo el `index.html` de ese repositorio** por el incluido en esta actualización; deja los otros archivos existentes que no estén en el ZIP.
3. Confirma los cambios con **Commit changes**.
4. Desde **Settings > Pages** verifica `Deploy from a branch`, `main` y `/(root)`, si esa es la configuración actual del proyecto.
5. Abre la URL publicada y pulsa **Crear cuenta**. Introduce un alias ficticio y recorre el caso hasta la evaluación.

## Flujo
- `index.html`: portada y simulador visual.
- `acceso.html`: alias de alumno, sin contraseñas ni correos electrónicos.
- `panel.html`: panel de apariencia financiera, cinco etapas y operaciones ficticias.
- `aula.html`: seis preguntas de criterio, con diagnóstico final e impresión de informe.
- `estilo.css`: estilos adaptables a ordenador y móvil.

## Datos y seguridad
- Sin procesador de pagos, fondos, billeteras, datos bancarios ni depósitos.
- Sin formularios de envío a correos o bases de datos en estas páginas del aula.
- Alias, progreso y respuestas únicamente en `localStorage` del navegador.
- El botón **Reiniciar caso** borra el progreso del panel y las respuestas del cuestionario. `aula.html` permite repetir el cuestionario.
- La portada procede de una versión previa del proyecto; revisa cualquier integración externa en otras páginas del repositorio antes de utilizarla con alumnos.

## Docente
Se recomienda presentar la actividad como un **caso ficticio de una plataforma financiera, sin revelar de entrada cuál es el tipo de estafa**; la página de evaluación explica los indicadores después de responder. El diagnóstico no sustituye consejo legal ni financiero. El profesor puede pedir capturas del resultado o usar Imprimir/Guardar como PDF.
