# Guion de defensa del proyecto ASPAR

Guía para presentar y defender el proyecto ante el tribunal: qué decir, qué mostrar, en qué orden y cómo responder las preguntas más probables. La evidencia de cada criterio de la rúbrica está en la [guía de evaluación](../RUBRICA_SPRINTS_1_A_3.md).

## 1. El proyecto en un minuto

ASPAR (Asociación de Parkinson «Mario Lagrava», La Paz) llevaba sus afiliados, actividades, asistencia, inventario y donaciones en cuadernos, hojas sueltas y WhatsApp. Eso hacía difícil saber quién asistía, qué material había prestado o cuánto se había recaudado, y los datos clínicos no tenían protección.

**La solución** tiene dos partes que usan la misma API:

- **El sitio público:** quiénes son, cronograma de actividades, galería, donaciones con QR y meta de recaudación, y contacto o preinscripción.
- **El espacio del equipo:** fichas de afiliados con historia clínica protegida, actividades y asistencia, inventario con préstamos, confirmación de donaciones, solicitudes, contenido del sitio, usuarios con roles y permisos, registro de actividad y reportes en Excel y PDF filtrados por fechas.

**En números:** 16 módulos de dominio, 114 endpoints, 25 tablas, 15 ADR. Pruebas: 42 unitarias con dobles, 483 de API, 413 de interfaz y 121 recorridos de punta a punta.

## 2. Reparto de la presentación (15 a 20 minutos)

| Parte | Quién | Tiempo | Qué se muestra |
| :--- | :--- | :---: | :--- |
| Problema, alcance y gestión | José (Director de Proyecto y Analista) | 4 min | SRS y backlog ISO 29148, Jira (4 sprints, story points, responsables), registro de sprints y retrospectivas |
| Arquitectura y base de datos | Dayana (Arquitecta y Backend) | 5 min | C4, ADR, modelo E-R y migraciones, UML, API en Swagger, transacciones y seguridad |
| Demostración del sistema | Mauricio (QA y Frontend) | 6 min | Recorrido de la sección 3 |
| Calidad y cierre | Mauricio y José | 3 min | CI en GitHub Actions, cobertura, pruebas unitarias y E2E, despliegue, trabajo futuro |

Cada integrante debe poder responder sobre cualquier parte, no solo la suya.

## 3. Demostración (en este orden)

Antes de empezar, levanta el entorno local con datos de demostración (`docker compose up --build -d` y luego `make seed`), o usa el sitio publicado. **Nunca corras `make seed` contra la base de producción.** Las cuentas de demostración las imprime `make seed`; Administración es `admin@aspar.org`.

1. **Sitio público:** inicio, cronograma, galería y la página de donaciones con la meta.
2. **Ingreso:**
   - Una contraseña incorrecta muestra un mensaje que no dice qué dato falló.
   - Tras 5 intentos fallidos, la cuenta espera 15 minutos (RF-01).
3. **Afiliados:**
   - Crea una ficha.
   - Entra como Recepción y muestra que **no ve la historia clínica**.
   - Entra como Profesional y muestra que **sí la ve**. La API solo envía la historia clínica con tres condiciones: rol clínico, consentimiento firmado y acceso activo (RNF-06).
4. **Actividades y asistencia:** publica una actividad. Aparece en el cronograma público y se toma asistencia el día de la actividad.
5. **Inventario:**
   - Registra un préstamo.
   - Intenta sacar más de lo que hay: el sistema lo impide, porque el stock nunca queda negativo.
6. **Donaciones:** confirma un aviso de donación con la referencia del extracto. La meta pública se actualiza.
7. **Reportes:** en cualquier pantalla, elige un rango de fechas y descarga en **Excel** y en **PDF**. Es el plan de mejora de la evaluación.
8. **Registro de actividad:** todo lo anterior quedó registrado (quién, qué, cuándo, desde qué IP), incluidas las descargas.
9. **Swagger:** `http://localhost:8000/docs`, solo en el entorno local. En producción está apagado a propósito.
10. **GitHub y Jira:**
    - en GitHub, el CI en verde, las etiquetas `v1.0`, `v2.0` y `v3.0` y los Pull Requests;
    - en Jira, el tablero con los sprints cerrados.

## 4. Lo que hay que saber explicar, por criterio

**Arquitectura (1.1)**
- Monolito modular: una sola API dividida en 16 módulos de dominio con la misma estructura.
- C4 de contexto, contenedores y componentes.
- Cada decisión importante está en un ADR con alternativas y consecuencias.
- Lectura: [principios de diseño](../arquitectura/PRINCIPIOS_DE_DISENO.md).

**Base de datos (1.2)**
- PostgreSQL con 6 migraciones SQL versionadas y protegidas con SHA-256.
- Claves foráneas con `ON DELETE` explícito y restricciones `CHECK` en la propia base.
- **ACID:** una transacción por petición (`app/core/database.py`) y bloqueo de fila (`SELECT … FOR UPDATE`) donde dos personas podrían chocar: stock, confirmación de donaciones y asistencia.

**UML (2.1)**
- Diagrama de clases del dominio, más 4 diagramas de secuencia de flujos reales: alta de afiliado, confirmación de donación, descarga de reporte y toma de asistencia.

**Backlog (2.2)**
- Cada requisito tiene su historia en Jira, fuente, prioridad MoSCoW, riesgo, estabilidad y forma de verificarlo (ISO/IEC/IEEE 29148).

**API (2.3)**
- REST con OpenAPI generado del código.
- El CI falla si el contrato cambia sin actualizarse, y los tipos del Frontend salen de ese contrato.

**Frontend (3.1)**
- Vue 3 con TypeScript.
- La capa `src/api/` usa `fetch` asíncrono, cookies HttpOnly, CSRF y renovación de la sesión.

**Pruebas (3.2)**
- `Backend/tests/unit/` prueba las reglas de negocio sin base de datos. Reemplaza repositorios, registro y reloj con `unittest.mock`, el equivalente de xUnit con Moq.
- Cobertura: 98 % en el Backend y 92,7 % en el Frontend.

**Incremento (3.3)**
- 121 recorridos de Playwright contra la API y la base reales.

**Git (4.x)**
- Conventional Commits con la clave de Jira, ramas por historia, Pull Requests y etiquetas de versión.
- La matriz RF ↔ Jira ↔ código ↔ prueba está al día.

**Scrum (5.x)**
- Sprints con objetivo, story points y responsable.
- [Retrospectivas](../scrum/RETROSPECTIVAS.md) con acciones cumplidas.

## 5. Preguntas probables y cómo responderlas

**¿Por qué no usaron SQL Server, .NET y Flutter, como dice la rúbrica?**
ASPAR es un proyecto del tipo «Otro», y esas tecnologías son un ejemplo. Cada una tiene su equivalente justificado en un ADR:
- PostgreSQL en lugar de SQL Server: es gratuito en Supabase y la fundación no puede pagar licencias.
- FastAPI en lugar de .NET.
- Vue en lugar de Flutter: el personal usa el navegador y no hace falta instalar nada.

La tabla de equivalencias está al inicio de la guía de evaluación.

**¿Por qué un monolito y no microservicios?**
Somos tres personas y ASPAR tiene poco tráfico. Los microservicios multiplicarían despliegues, costos y fallas de red sin ningún beneficio. El monolito es **modular**: cada dominio está aislado, así un módulo podría separarse más adelante si hiciera falta.

**¿Dónde se ve SOLID?** Ver la tabla de [principios de diseño](../arquitectura/PRINCIPIOS_DE_DISENO.md):
- **S:** cada módulo separa HTTP, reglas y consultas.
- **O:** se agregó el PDF sin tocar ningún módulo.
- **L:** los proveedores de correo son intercambiables.
- **I:** interfaces pequeñas con `Protocol`.
- **D:** las dependencias se inyectan con `Depends`, y las pruebas las reemplazan.

**¿Cómo protegen los datos clínicos?**
- La regla vive en el servidor, no en la pantalla.
- Los permisos están en la base y se comprueban en cada petición.
- La historia clínica solo sale con las tres condiciones de RNF-06.
- Los documentos son privados y se abren con un enlace que caduca.
- El registro de actividad no se puede editar ni borrar.

**¿Cómo funciona la sesión? ¿Dónde está el JWT?**
- El JWT va en una cookie HttpOnly, que JavaScript no puede leer, con protección CSRF.
- El servidor además valida la sesión, así cerrar sesión o desactivar una cuenta la corta de inmediato.
- Hay bloqueo por intentos fallidos y cierre por inactividad.

**¿Qué es una prueba unitaria con mocks en su proyecto?** Por ejemplo, la confirmación de una donación:
- Se reemplazan el repositorio y el reloj por dobles.
- Se comprueba que una referencia repetida se rechaza y que no se confirma con fecha futura.
- No toca la base y corre en menos de un segundo.

**¿Cómo evitan que el Frontend y el Backend se desalineen?**
- El contrato OpenAPI se genera del código y una prueba lo compara.
- Los tipos TypeScript del Frontend se generan de ese contrato.
- Si alguien cambia la API sin avisar, el CI se pone en rojo.

**¿Cómo garantizan la calidad antes de integrar?**
- GitHub Actions en cada push: lint, tipos, pruebas, cobertura mínima del 70 %, contrato y auditoría de dependencias (`pip-audit`, `npm audit`).
- Así se detectaron y corrigieron dos vulnerabilidades en la librería de PDF antes de integrar.

**¿Por qué Excel y PDF y no CSV?**
- Excel sirve para trabajar los datos: filtrar, sumar o hacer gráficos.
- El PDF sirve para imprimir o enviar sin que se pueda modificar: lleva la marca, el filtro aplicado, quién lo descargó y la fecha.
- El CSV no aportaba nada que Excel no tenga.

**¿Dónde corre y cuánto cuesta?**
- API en Google Cloud Run y base en Supabase, ambas en São Paulo, la región más cercana a Bolivia.
- Sitio en Cloudflare Pages y fotos en Cloudinary.
- Todo usa planes gratuitos o el nivel gratuito de Cloud Run, con un presupuesto de 5 USD y alertas.

**¿Qué pasa si la base se apaga o se pierde?**
- Un workflow consulta la API y la base cada 6 horas: avisa si algo cae y evita que Supabase pause la base por inactividad.
- Otro workflow hace un respaldo diario cifrado fuera del servidor principal, y la guía explica cómo restaurarlo.

**¿Qué aprendieron o qué cambiarían?** Está en las [retrospectivas](../scrum/RETROSPECTIVAS.md):
- mantener la documentación junto al código;
- asignar responsables desde la planificación;
- revisar entre pares cada pantalla;
- repartir mejor los commits del cierre.

**¿Qué falta o qué sigue?** El épico «Evolución futura» en Jira:
- convertir la web en una aplicación instalable (PWA);
- notificaciones de cambios en el cronograma;
- estadísticas ampliadas;
- migrar las fotos antiguas de Google Drive;
- evaluar un módulo de servicios clínicos.

## 6. Lista para el día de la defensa

- [ ] `Sprint3` integrada en `main` por Pull Request y etiqueta `v3.0` creada.
- [ ] CI en verde en `main`.
- [ ] Sprint 4 cerrado en Jira; lo pendiente, en el backlog con responsable.
- [ ] Entorno local probado con `make seed`, o el sitio publicado con una cuenta de Administración.
- [ ] Cada integrante repasó las preguntas de la sección 5.
- [ ] Plan B: si falla internet, demostración en Docker local y capturas del [manual](../manual/MANUAL_DE_USUARIO.md).
