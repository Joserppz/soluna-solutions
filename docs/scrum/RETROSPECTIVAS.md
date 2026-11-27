# Retrospectivas de los sprints

Una retrospectiva por sprint: qué salió bien, qué mejorar y las acciones acordadas, con su responsable y dónde quedó cada una. Los hechos salen del historial de Git, del CI, de Jira y de la evaluación de los Sprints 1 y 2. El objetivo y el incremento de cada sprint están en el [registro de sprints](./REGISTRO_DE_SPRINTS.md).

## Sprint 1 — Arquitectura y base de datos (19/10 al 01/11/2026)

**Salió bien**

- El CI funcionó desde el primer incremento: lint, migraciones sobre una base vacía, pruebas y cobertura mínima en cada push.
- Las decisiones técnicas quedaron escritas en ADR (ADR-001 a ADR-010) antes de programar, y eso evitó discusiones repetidas.
- La protección de datos clínicos (RNF-06) se resolvió en el servidor desde el principio, no solo en la interfaz.

**Por mejorar**

- Parte de Jira y de los primeros documentos seguía describiendo un Frontend en React, cuando el equipo ya trabajaba en Vue 3. La documentación se había separado del código.
- La planificación inicial tenía cinco sprints con un alcance mayor al que cabía en las fechas reales.

**Acciones**

| Acción | Responsable | Resultado |
| :--- | :--- | :--- |
| Mantener la trazabilidad requisito → historia → código → prueba en un solo documento | José | [Matriz de trazabilidad](../trazabilidad/MATRIZ_RF01_RF17.md) (SCRUM-136) |
| Redibujar el C4 y el modelo E-R a partir del código vigente | Dayana | [C4 y E-R actualizados](../arquitectura/C4_Y_MODELO_ER_ACTUALIZADO.md) (SCRUM-64) |
| Generar el contrato de la API desde el código y validarlo en el CI | Dayana y Mauricio | [ADR-013](../arquitectura/adr/ADR-013-contrato-openapi-y-capa-src-api.md), `test_openapi.py` y `npm run api:types:check` |

## Sprint 2 — UML, Jira y API REST (01/11 al 16/11/2026)

**Salió bien**

- La API se completó por módulos de dominio con la misma estructura (router, service, repository, schemas, models), y el Frontend pudo conectar todas las pantallas sin esperar al final.
- El contrato OpenAPI compartido evitó que la API y la interfaz se desalinearan.

**Por mejorar** (incluye la evaluación de los Sprints 1 y 2 del 18/11)

- Faltaban el filtro por fechas y los reportes completos en cada pantalla.
- Varias historias del tablero no tenían responsable ni estimación.
- Coordinación: algunas pantallas se cerraron sin que otro integrante las revisara.

**Acciones**

| Acción | Responsable | Resultado |
| :--- | :--- | :--- |
| Filtro por fechas y descarga completa en cada pantalla, con registro de lo exportado | Equipo | Hecho en el Sprint 4 ([ADR-015](../arquitectura/adr/ADR-015-filtros-por-fecha-y-reportes.md), [evidencia](../evidencias/EVIDENCIAS_SPRINT3_REPORTES.md)) |
| Responsable y story points en cada historia y tarea de los sprints | José | Hecho en Jira |
| Revisión cruzada: otro integrante prueba cada pantalla antes de cerrarla | Mauricio | Recorridos E2E de cada pantalla ([`Frontend/e2e/`](../../Frontend/e2e/)) |

## Sprint 3 — Frontend: portal y multimedia (11/11 al 25/11/2026)

**Salió bien**

- El portal público y el espacio del equipo comparten los mismos componentes, y se verificaron de 360 a 1920 px y con criterios de accesibilidad.
- Las fotos se suben directo a Cloudinary con una firma de la API: el servidor no recibe archivos pesados ([ADR-010](../arquitectura/adr/ADR-010-multimedia-en-cloudinary.md)).

**Por mejorar**

- Se definió tarde qué rama era la de producción y cómo se desplegaba cada parte.

**Acciones**

| Acción | Responsable | Resultado |
| :--- | :--- | :--- |
| `main` como rama de producción y guía de despliegue paso a paso | José | [Despliegue sin dominio](../despliegue/DESPLIEGUE_SIN_DOMINIO.md) y [ADR-014](../arquitectura/adr/ADR-014-despliegue-y-operacion.md) |

## Sprint 4 — Integración, reportes y cierre (25/11 al 27/11/2026)

**Salió bien**

- El plan de mejora de la evaluación quedó completo: 9 pantallas con fechas y descarga en Excel y PDF, cubiertas por pruebas de API, de interfaz y E2E.
- El CI detectó a tiempo dos vulnerabilidades en la librería de PDF (`pip-audit`), y se corrigieron antes de integrar.
- Se agregaron el paquete UML, las pruebas unitarias con dobles y el manual de usuario.

**Por mejorar**

- La imagen de Docker local no se reconstruyó después de agregar una dependencia, y la API dejó de arrancar en las máquinas del equipo.
- La región de la API en la documentación no coincidía con la de la base creada en Supabase (São Paulo).
- Los commits del cierre se concentraron en una sola persona.

**Acciones**

| Acción | Responsable | Resultado |
| :--- | :--- | :--- |
| Reconstruir la imagen (`docker compose up --build -d`) cada vez que cambian las dependencias | Dayana | Indicado en el [README del Backend](../../Backend/README.md) |
| Revisar la configuración de despliegue contra los servicios reales antes de publicar | José | API y base en São Paulo ([ADR-014](../arquitectura/adr/ADR-014-despliegue-y-operacion.md)) |
| Cada integrante revisa y aprueba al menos un Pull Request del cierre y aporta su parte del despliegue | Dayana (respaldo, SCRUM-140) y Mauricio (sitio en Cloudflare Pages, SCRUM-117) | Pull Request de `Sprint3` a `main` |
