# ADR-010: Galería multimedia en Cloudinary y documentos privados en Supabase Storage

- **Estado:** Aceptada (RF-05 implementado en el Sprint 2)
- **Fecha:** 2026-10-27
- **Requisitos:** RF-05 (multimedia), RNF-06 (privacidad), RNF-10 (cuota de Cloudinary)

## Contexto

El C2 original tenía un único contenedor «Cloud Storage». En el Sprint 1 se implementó Supabase Storage para los **documentos privados** de pacientes (ADR-005). La historia RNF-10 de Jira (SCRUM-127, «Cuota de Cloudinary») define que la **galería multimedia** se almacena en Cloudinary, con control de consumo y contingencia. Son dos necesidades distintas: archivos clínicos privados y fotos y videos públicos de las actividades.

## Decisión

| Contenido | Almacenamiento | Acceso |
| :--- | :--- | :--- |
| Documentos de pacientes (CI, certificados, evaluaciones, consentimientos) | **Supabase Storage**, bucket privado `documentos-pacientes` | Solo roles clínicos, con URL firmada de 300 s (ADR-005) |
| Fotos y videos de las actividades (RF-05) | **Cloudinary** | Público en el portal; la carga, solo para el personal autenticado |

- El Backend sube los archivos a Cloudinary; las credenciales viven solo en `Backend/.env`.
- Se guardan en `media_assets` la URL, el tamaño y quién lo subió.
- Las miniaturas y la carga diferida se resuelven con las transformaciones de Cloudinary (SCRUM-150).

## Alternativas descartadas

- **Todo en Supabase Storage:** una sola cuenta, pero el plan gratuito tiene menos espacio y no transforma imágenes ni videos.
- **Todo en Cloudinary:** los documentos clínicos no deben estar en un servicio pensado para contenido público.

## Consecuencias

- ✅ Cada tipo de archivo queda en el servicio adecuado y RNF-06 no depende de Cloudinary.
- ⚠️ Hay que vigilar la cuota gratuita de Cloudinary (alerta y contingencia en SCRUM-149 y SCRUM-151).
- ✅ Implementado en el Sprint 2: `media_assets.provider` solo admite `cloudinary`; la API firma cada subida con formatos permitidos y una carpeta por álbum, y al quitar un archivo o un álbum lo borra también en Cloudinary (API `destroy`), solo después de confirmar la transacción.
- ✅ La galería del equipo y la del sitio usan solo Cloudinary (F5a y F5b). Los datos de ejemplo del modo demo, que decían «Cloudinary / AWS S3», se retiraron con él.

## Evidencia

Historias SCRUM-20 (RF-05) y SCRUM-127 (RNF-10) en Jira; `Backend/migrations/001_base.sql` (tablas `media_albums`, `media_assets` y `media_patient_tags`); `Backend/app/adapters/cloudinary.py`; `Backend/app/modules/media/`; `Backend/tests/test_media.py`; `Backend/app/adapters/storage.py` (documentos privados).
