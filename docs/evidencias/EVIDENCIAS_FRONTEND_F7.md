# Evidencia del bloque F7 del Frontend: mejoras antes del despliegue

Mejoras pedidas por el PO después de revisar el sitio y el espacio del equipo:

- **Sitio público:** pie con «Contáctanos» más claro (el correo en una tarjeta; WhatsApp ya tiene su botón flotante), Galería con ícono, página de **Privacidad**, página **404** con los colores del sitio y **vista previa al compartir** el enlace en WhatsApp o Facebook.
- **Espacio del equipo:** **íconos** en el menú lateral, **listas vacías** con dibujo y botón para crear lo primero, **aviso de cambios sin guardar** con una ventana propia y **lista de asistencia para imprimir**.

## Cómo se entregó

| Commit | Qué trae |
| :--- | :--- |
| `feat(sitio): privacidad, página 404 propia, vista previa al compartir y pie más claro` | Pie, `/privacidad`, 404, etiquetas Open Graph con `public/compartir.jpg` (1200×630) y `VITE_SITE_URL` |
| `feat(equipo): íconos del menú, listas vacías, cambios sin guardar y asistencia impresa` | `AppIcon`, `EmptyState`, `useUnsavedChanges` con `UnsavedChangesDialog`, `AttendancePrintSheet`, sus pruebas y esta evidencia |

## Qué cambió

| Mejora | Detalle |
| :--- | :--- |
| Contáctanos | El correo de ASPAR en una tarjeta con ícono. El número de WhatsApp ya no se repite: está en el botón «Escríbenos» |
| Galería en el pie | Ícono de foto, igual que Facebook y TikTok |
| Privacidad (`/privacidad`) | Qué datos se guardan, para qué, quién los ve, fotos, seguridad y derechos. Solo describe lo que el sistema ya hace (RNF-06: roles, enlaces de documentos de 5 minutos, registro de actividad). El permiso del formulario de contacto la enlaza en otra pestaña |
| 404 | Un camino perdido, «Ir al inicio», «Apoya a ASPAR» (o «Volver al espacio del equipo» con sesión) y el enlace a contacto |
| Vista previa al compartir | `og:title`, `og:description`, `og:image` (1200×630) y `twitter:card`. La dirección completa sale de `VITE_SITE_URL`; si falta, de la que dan Vercel o Cloudflare Pages al construir |
| Íconos del menú | Un ícono de línea por sección (y en Administración, Ver sitio público y Cerrar sesión). Son decorativos: el nombre sigue escrito |
| Listas vacías | Afiliados, Inventario, Galería, Donaciones y Solicitudes muestran un dibujo, qué pasa y el botón para crear lo primero («+ Registrar el primer afiliado», «+ Registrar el primer material», «+ Crear el primer álbum», «+ Registrar un aporte»). Con filtros, ofrecen quitarlos |
| Cambios sin guardar | La ficha (pestañas Datos e Historia clínica), Contenido y la meta de donaciones preguntan con la ventana «Tienes cambios sin guardar» antes de salir, cambiar de pestaña o cerrar. Cerrar o recargar la pestaña del navegador también avisa. Cerrar sesión no pregunta |
| Asistencia impresa | «Imprimir lista» saca una hoja A4 con todas las personas en orden alfabético, lo que ya estaba marcado, columnas Vino / No vino / Observaciones, seis renglones para personas nuevas y la firma de quien tomó la lista. En la pantalla la hoja no se ve |

## Cómo se verificó

| Verificación | Resultado |
| :--- | :--- |
| `npm run lint`, `prettier --check`, `vue-tsc` y `npm run build` | Sin errores |
| `npm run test:coverage` | Ver la tabla del cierre del bloque en el mensaje de entrega |
| Pruebas nuevas | Pie, privacidad y su enlace, 404, íconos del menú, las cinco listas vacías con su botón, cambios sin guardar en la ficha, Contenido y la meta (también `beforeunload`) y la hoja impresa |
| `e2e/accesibilidad.spec.ts` | Suma `/privacidad` y la 404 a la revisión de 360 a 1920 px |
| Hoja impresa | Revisada con la vista de impresión de Chromium (A4) contra la API de Docker |

## Pendiente

- Fotos reales de ASPAR (sitio y `public/compartir.jpg`), cuando estén con permiso de imagen.
