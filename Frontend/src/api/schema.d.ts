/**
 * ARCHIVO GENERADO: no lo edites a mano.
 * Fuente: docs/api/openapi.json. Regenerar con: npm run api:types
 */

export interface paths {
  '/api/v1/attendance/monthly': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /**
     * Monthly Summary
     * @description Resumen del mes por actividad y por tipo. Con format=csv o xlsx se descarga.
     */
    get: operations['monthly_summary_api_v1_attendance_monthly_get']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/audit': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** List Audit Events */
    get: operations['list_audit_events_api_v1_audit_get']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/audit/export': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /**
     * Export Audit
     * @description «Descargar registro»: lo que muestra el filtro (hasta 5000 movimientos).
     */
    get: operations['export_audit_api_v1_audit_export_get']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/audit/summary': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /**
     * Audit Summary
     * @description Esta semana (o los últimos N días): movimientos por área y situaciones para revisar.
     */
    get: operations['audit_summary_api_v1_audit_summary_get']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/auth/change-password': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    /**
     * Change Password
     * @description Cambio de la contraseña propia (también la temporal entregada por Administración).
     */
    post: operations['change_password_api_v1_auth_change_password_post']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/auth/forgot-password': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    /** Forgot Password */
    post: operations['forgot_password_api_v1_auth_forgot_password_post']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/auth/google': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    /**
     * Login With Google
     * @description Continuar con Google: inicia sesión o crea una cuenta pendiente de aprobación.
     */
    post: operations['login_with_google_api_v1_auth_google_post']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/auth/login': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    /** Login */
    post: operations['login_api_v1_auth_login_post']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/auth/logout': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    /** Logout */
    post: operations['logout_api_v1_auth_logout_post']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/auth/me': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /**
     * Me
     * @description Usuario de la sesión actual (el frontend lo consulta al cargar la página).
     */
    get: operations['me_api_v1_auth_me_get']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/auth/refresh': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    /** Refresh */
    post: operations['refresh_api_v1_auth_refresh_post']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/auth/register': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    /**
     * Register
     * @description Crea una cuenta sin rol y envía el enlace de verificación (respuesta siempre igual).
     */
    post: operations['register_api_v1_auth_register_post']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/auth/resend-verification': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    /** Resend Verification */
    post: operations['resend_verification_api_v1_auth_resend_verification_post']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/auth/reset-password': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    /** Reset Password */
    post: operations['reset_password_api_v1_auth_reset_password_post']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/auth/verify-email': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    /** Verify Email */
    post: operations['verify_email_api_v1_auth_verify_email_post']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/content/sections': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /**
     * List Sections
     * @description Las 7 secciones del sitio con su borrador, lo publicado y si hay cambios sin publicar.
     */
    get: operations['list_sections_api_v1_content_sections_get']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/content/sections/{key}': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** Get Section */
    get: operations['get_section_api_v1_content_sections__key__get']
    /**
     * Save Draft
     * @description «Guardar borrador»: el sitio no cambia hasta publicar.
     */
    put: operations['save_draft_api_v1_content_sections__key__put']
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/content/sections/{key}/publish': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    /**
     * Publish
     * @description «Publicar cambios»: el borrador pasa a verse en el sitio.
     */
    post: operations['publish_api_v1_content_sections__key__publish_post']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/content/social-links': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    /**
     * Save Social Links
     * @description Enlaces oficiales a Facebook, Instagram y TikTok (se publican al guardar).
     */
    put: operations['save_social_links_api_v1_content_social_links_put']
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/dashboard/summary': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /**
     * Summary
     * @description «Para revisar», próxima actividad, asistencia de los últimos 8 sábados y afiliados.
     */
    get: operations['summary_api_v1_dashboard_summary_get']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/donations': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /**
     * List Donations
     * @description Registro de aportes; busca por donante o comprobante.
     */
    get: operations['list_donations_api_v1_donations_get']
    put?: never
    /**
     * Register Manual
     * @description «Registrar aporte recibido»: efectivo (confirmado) o en especie (recibido + inventario).
     */
    post: operations['register_manual_api_v1_donations_post']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/donations/goal': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** Get Goal */
    get: operations['get_goal_api_v1_donations_goal_get']
    /**
     * Save Goal
     * @description «Editar meta»: título, monto, ajuste manual, hitos y si se ve en el sitio.
     */
    put: operations['save_goal_api_v1_donations_goal_put']
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/donations/summary': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /**
     * Summary
     * @description Resumen del mes: confirmado por canal, avisos por confirmar, especie y anulados.
     *
     *     Con format=csv o xlsx se descarga el resumen y el detalle de cada aporte del mes.
     */
    get: operations['summary_api_v1_donations_summary_get']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/donations/{donation_id}': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** Get Donation */
    get: operations['get_donation_api_v1_donations__donation_id__get']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/donations/{donation_id}/cancel': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    /**
     * Cancel
     * @description Pendiente → anulado con motivo (queda en el historial y en la bitácora).
     */
    post: operations['cancel_api_v1_donations__donation_id__cancel_post']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/donations/{donation_id}/confirm': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    /**
     * Confirm
     * @description Pendiente → confirmado con la referencia del extracto: suma a la meta.
     */
    post: operations['confirm_api_v1_donations__donation_id__confirm_post']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/health': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /**
     * Health
     * @description Prueba de vida liviana: no consulta la base (la usan Docker y Cloud Run).
     */
    get: operations['health_api_v1_health_get']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/health/db': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /**
     * Health Db
     * @description Verifica la conexión con PostgreSQL; si falla responde 503.
     */
    get: operations['health_db_api_v1_health_db_get']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/inquiries': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /**
     * List Inquiries
     * @description Bandeja, la más reciente primero; busca por nombre o teléfono.
     */
    get: operations['list_inquiries_api_v1_inquiries_get']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/inquiries/summary': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** Summary */
    get: operations['summary_api_v1_inquiries_summary_get']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/inquiries/{inquiry_id}': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /**
     * Get Inquiry
     * @description Solicitud con su historial de notas.
     */
    get: operations['get_inquiry_api_v1_inquiries__inquiry_id__get']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    /**
     * Update Inquiry
     * @description Cambia el estado (Nueva → Por contactar → Contactada, o Cerrada) o la persona asignada.
     */
    patch: operations['update_inquiry_api_v1_inquiries__inquiry_id__patch']
    trace?: never
  }
  '/api/v1/inquiries/{inquiry_id}/convert-to-patient': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    /**
     * Convert To Patient
     * @description «Inscribir como afiliado»: abre la ficha con nombre y teléfono ya cargados.
     */
    post: operations['convert_to_patient_api_v1_inquiries__inquiry_id__convert_to_patient_post']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/inquiries/{inquiry_id}/notes': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    /**
     * Add Note
     * @description Nota de la llamada; con markContacted=true la marca como contactada.
     */
    post: operations['add_note_api_v1_inquiries__inquiry_id__notes_post']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/inquiries/{inquiry_id}/patient-draft': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /**
     * Patient Draft
     * @description Datos para precargar la ficha antes de inscribir.
     */
    get: operations['patient_draft_api_v1_inquiries__inquiry_id__patient_draft_get']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/inventory': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /**
     * List Items
     * @description Materiales por nombre, con filtros de origen, categoría y condición.
     */
    get: operations['list_items_api_v1_inventory_get']
    put?: never
    /**
     * Create Item
     * @description Registra un material; su cantidad inicial queda como movimiento de ingreso.
     */
    post: operations['create_item_api_v1_inventory_post']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/inventory/export': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /**
     * Export Inventory
     * @description Inventario activo para la rendición de cuentas (Alcaldía) y el resto.
     */
    get: operations['export_inventory_api_v1_inventory_export_get']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/inventory/summary': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /**
     * Summary
     * @description Contadores del encabezado: registrados, de la Alcaldía, donados, propios y dañados.
     */
    get: operations['summary_api_v1_inventory_summary_get']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/inventory/{item_id}': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** Get Item */
    get: operations['get_item_api_v1_inventory__item_id__get']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    /**
     * Update Item
     * @description Edita el material. Cambiar la cantidad exige «reason» y queda como ajuste.
     */
    patch: operations['update_item_api_v1_inventory__item_id__patch']
    trace?: never
  }
  '/api/v1/inventory/{item_id}/deactivate': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    /**
     * Deactivate
     * @description Baja lógica con motivo: deja la cantidad en 0 con un movimiento de baja.
     */
    post: operations['deactivate_api_v1_inventory__item_id__deactivate_post']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/inventory/{item_id}/movements': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /**
     * List Movements
     * @description «Historial de este material», el más reciente primero.
     */
    get: operations['list_movements_api_v1_inventory__item_id__movements_get']
    put?: never
    /**
     * Add Movement
     * @description Ingreso, préstamo, devolución o ajuste; actualiza la cantidad disponible.
     */
    post: operations['add_movement_api_v1_inventory__item_id__movements_post']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/media/albums': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** List Albums */
    get: operations['list_albums_api_v1_media_albums_get']
    put?: never
    /** Create Album */
    post: operations['create_album_api_v1_media_albums_post']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/media/albums/{album_id}': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /**
     * Get Album
     * @description Álbum con sus archivos, las personas etiquetadas y las advertencias de permiso.
     */
    get: operations['get_album_api_v1_media_albums__album_id__get']
    put?: never
    post?: never
    /**
     * Delete Album
     * @description Elimina un álbum que no está publicado (y sus archivos en Cloudinary).
     */
    delete: operations['delete_album_api_v1_media_albums__album_id__delete']
    options?: never
    head?: never
    /** Update Album */
    patch: operations['update_album_api_v1_media_albums__album_id__patch']
    trace?: never
  }
  '/api/v1/media/albums/{album_id}/assets': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    /**
     * Add Asset
     * @description Registra un archivo ya subido a Cloudinary. Un álbum publicado vuelve a revisión.
     */
    post: operations['add_asset_api_v1_media_albums__album_id__assets_post']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/media/albums/{album_id}/publish': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    /**
     * Publish
     * @description Publica en el sitio: exige la revisión de permisos y ninguna advertencia pendiente.
     */
    post: operations['publish_api_v1_media_albums__album_id__publish_post']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/media/albums/{album_id}/unpublish': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    /** Unpublish */
    post: operations['unpublish_api_v1_media_albums__album_id__unpublish_post']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/media/albums/{album_id}/upload-signature': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    /**
     * Upload Signature
     * @description Firma para subir un archivo directo a Cloudinary (JPG, PNG, WEBP o MP4).
     */
    post: operations['upload_signature_api_v1_media_albums__album_id__upload_signature_post']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/media/assets/{asset_id}': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    post?: never
    /**
     * Remove Asset
     * @description Quita el archivo del álbum y lo borra de Cloudinary al confirmar.
     */
    delete: operations['remove_asset_api_v1_media_assets__asset_id__delete']
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/media/assets/{asset_id}/tags': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    /**
     * Set Tags
     * @description Personas que aparecen en la foto. tags[].imageConsent=false bloquea la publicación.
     */
    put: operations['set_tags_api_v1_media_assets__asset_id__tags_put']
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/patients': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** List Patients */
    get: operations['list_patients_api_v1_patients_get']
    put?: never
    /** Create Patient */
    post: operations['create_patient_api_v1_patients_post']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/patients/summary': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /**
     * Patient Counts
     * @description Contadores de las pestañas (con la misma búsqueda y actividad del listado).
     */
    get: operations['patient_counts_api_v1_patients_summary_get']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/patients/{patient_id}': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** Get Patient */
    get: operations['get_patient_api_v1_patients__patient_id__get']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    /** Update Patient */
    patch: operations['update_patient_api_v1_patients__patient_id__patch']
    trace?: never
  }
  '/api/v1/patients/{patient_id}/attendance': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /**
     * Patient Attendance
     * @description Asistencia de un afiliado: «11 de 12 sábados este trimestre» y su historial.
     */
    get: operations['patient_attendance_api_v1_patients__patient_id__attendance_get']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/patients/{patient_id}/contacts': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** List Contacts */
    get: operations['list_contacts_api_v1_patients__patient_id__contacts_get']
    put?: never
    /**
     * Add Contact
     * @description Agrega un familiar o cuidador (hasta 5 activos). Con isPrimary pasa a ser el principal.
     */
    post: operations['add_contact_api_v1_patients__patient_id__contacts_post']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/patients/{patient_id}/contacts/{contact_id}': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    post?: never
    /**
     * Remove Contact
     * @description Quita un contacto (baja lógica). La ficha conserva siempre al menos uno activo.
     */
    delete: operations['remove_contact_api_v1_patients__patient_id__contacts__contact_id__delete']
    options?: never
    head?: never
    /** Update Contact */
    patch: operations['update_contact_api_v1_patients__patient_id__contacts__contact_id__patch']
    trace?: never
  }
  '/api/v1/patients/{patient_id}/deactivate': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    /**
     * Deactivate Patient
     * @description Baja lógica con motivo: nada se elimina (reemplaza a DELETE /patients/{id}).
     */
    post: operations['deactivate_patient_api_v1_patients__patient_id__deactivate_post']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/patients/{patient_id}/documents': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** List Documents */
    get: operations['list_documents_api_v1_patients__patient_id__documents_get']
    put?: never
    /** Upload Document */
    post: operations['upload_document_api_v1_patients__patient_id__documents_post']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/patients/{patient_id}/documents/{document_id}': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    post?: never
    /** Delete Document */
    delete: operations['delete_document_api_v1_patients__patient_id__documents__document_id__delete']
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/patients/{patient_id}/documents/{document_id}/url': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** Document Url */
    get: operations['document_url_api_v1_patients__patient_id__documents__document_id__url_get']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/patients/{patient_id}/evaluations': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /**
     * List Evaluations
     * @description Evaluaciones de seguimiento, la más reciente primero (queda en la bitácora).
     */
    get: operations['list_evaluations_api_v1_patients__patient_id__evaluations_get']
    put?: never
    /** Create Evaluation */
    post: operations['create_evaluation_api_v1_patients__patient_id__evaluations_post']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/patients/{patient_id}/evaluations/{evaluation_id}': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** Get Evaluation */
    get: operations['get_evaluation_api_v1_patients__patient_id__evaluations__evaluation_id__get']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    /**
     * Update Evaluation
     * @description Corrige una evaluación. No hay DELETE: la historia clínica no se borra.
     */
    patch: operations['update_evaluation_api_v1_patients__patient_id__evaluations__evaluation_id__patch']
    trace?: never
  }
  '/api/v1/patients/{patient_id}/evaluations/{evaluation_id}/remove': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    /**
     * Remove Evaluation
     * @description Quita una evaluación registrada por error (por ejemplo, en la ficha de otra
     *     persona). Es una baja lógica: deja de mostrarse y se conserva con su motivo.
     */
    post: operations['remove_evaluation_api_v1_patients__patient_id__evaluations__evaluation_id__remove_post']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/patients/{patient_id}/reactivate': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    /**
     * Reactivate Patient
     * @description Vuelve a activar una ficha dada de baja, con el motivo (por ejemplo, volvió a venir).
     */
    post: operations['reactivate_patient_api_v1_patients__patient_id__reactivate_post']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/public/content': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /**
     * Public Content
     * @description Secciones publicadas del sitio (sin borradores).
     */
    get: operations['public_content_api_v1_public_content_get']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/public/content/{key}': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** Public Section */
    get: operations['public_section_api_v1_public_content__key__get']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/public/donations/goal': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /**
     * Public Goal
     * @description Meta visible en el sitio e hitos; null si no hay meta visible.
     */
    get: operations['public_goal_api_v1_public_donations_goal_get']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/public/donations/notice': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    /**
     * Register Notice
     * @description «Ya hice mi aporte»: aviso de un aporte por QR bancario (queda pendiente).
     */
    post: operations['register_notice_api_v1_public_donations_notice_post']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/public/donations/notice/{donation_id}': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /**
     * Track Notice
     * @description Estado de un aviso (Pendiente → Confirmado) con el id que recibió la persona.
     */
    get: operations['track_notice_api_v1_public_donations_notice__donation_id__get']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/public/inquiries': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    /**
     * Create Public
     * @description Orientación, voluntariado, donación en especie, «Quiero participar» u otro motivo.
     */
    post: operations['create_public_api_v1_public_inquiries_post']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/public/media/albums': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /**
     * Public Albums
     * @description Álbumes publicados (sin etiquetas ni datos de afiliados).
     */
    get: operations['public_albums_api_v1_public_media_albums_get']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/public/media/albums/{album_id}': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** Public Album */
    get: operations['public_album_api_v1_public_media_albums__album_id__get']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/public/schedules': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /**
     * Public Schedules
     * @description Agenda del sitio, sin iniciar sesión: actividades publicadas y canceladas.
     *
     *     Por defecto desde hoy y por 90 días. No incluye borradores ni datos del equipo.
     */
    get: operations['public_schedules_api_v1_public_schedules_get']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/roles': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /**
     * Get Matrix
     * @description Roles con sus permisos y el catálogo de permisos (con los sensibles marcados).
     */
    get: operations['get_matrix_api_v1_roles_get']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/roles/{role_key}/permissions': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    /**
     * Update Permissions
     * @description Reemplaza los permisos de un rol que no es del sistema.
     *
     *     Si se agregan permisos sensibles hay que reenviar con ``confirmSensitive: true``
     *     (409 con la lista de lo que se va a dar).
     */
    put: operations['update_permissions_api_v1_roles__role_key__permissions_put']
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/schedules': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /**
     * List Schedules
     * @description Agenda interna (incluye borradores), por fecha y hora.
     */
    get: operations['list_schedules_api_v1_schedules_get']
    put?: never
    /** Create Schedule */
    post: operations['create_schedule_api_v1_schedules_post']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/schedules/{schedule_id}': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /** Get Schedule */
    get: operations['get_schedule_api_v1_schedules__schedule_id__get']
    put?: never
    post?: never
    /**
     * Delete
     * @description Elimina un borrador. Una actividad publicada no se borra: se cancela.
     */
    delete: operations['delete_api_v1_schedules__schedule_id__delete']
    options?: never
    head?: never
    /** Update Schedule */
    patch: operations['update_schedule_api_v1_schedules__schedule_id__patch']
    trace?: never
  }
  '/api/v1/schedules/{schedule_id}/attendance': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /**
     * Get Sheet
     * @description Lista del día: afiliados activos con lo que se marcó, por nombre.
     */
    get: operations['get_sheet_api_v1_schedules__schedule_id__attendance_get']
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/schedules/{schedule_id}/attendance/close': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    /**
     * Close
     * @description «Cerrar asistencia del día»: después ya no se puede marcar.
     */
    post: operations['close_api_v1_schedules__schedule_id__attendance_close_post']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/schedules/{schedule_id}/attendance/mark-all-present': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    /**
     * Mark All Present
     * @description «Marcar a todos como presentes»: solo cambia a quienes siguen sin marcar.
     */
    post: operations['mark_all_present_api_v1_schedules__schedule_id__attendance_mark_all_present_post']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/schedules/{schedule_id}/attendance/newcomers': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    /**
     * Add Newcomer
     * @description «Anotar persona nueva»: crea una solicitud (origen asistencia) para Recepción.
     */
    post: operations['add_newcomer_api_v1_schedules__schedule_id__attendance_newcomers_post']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/schedules/{schedule_id}/attendance/reopen': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    /**
     * Reopen
     * @description Reabre una asistencia cerrada para corregirla (Coordinación).
     */
    post: operations['reopen_api_v1_schedules__schedule_id__attendance_reopen_post']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/schedules/{schedule_id}/attendance/{patient_id}': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    /**
     * Mark
     * @description Vino / No vino / sin marcar, con una nota rápida opcional.
     */
    put: operations['mark_api_v1_schedules__schedule_id__attendance__patient_id__put']
    post?: never
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/schedules/{schedule_id}/cancel': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    /**
     * Cancel
     * @description Cancela con un aviso para el sitio (por ejemplo «Se reprogramará en diciembre»).
     */
    post: operations['cancel_api_v1_schedules__schedule_id__cancel_post']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/schedules/{schedule_id}/publish': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    /**
     * Publish
     * @description Borrador → publicada: aparece en el sitio.
     */
    post: operations['publish_api_v1_schedules__schedule_id__publish_post']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/schedules/{schedule_id}/unpublish': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    /**
     * Unpublish
     * @description Publicada → borrador: deja de verse en el sitio.
     */
    post: operations['unpublish_api_v1_schedules__schedule_id__unpublish_post']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/users': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    /**
     * List Users
     * @description Equipo, con búsqueda por nombre o correo y filtro por rol.
     */
    get: operations['list_users_api_v1_users_get']
    put?: never
    /** Create User */
    post: operations['create_user_api_v1_users_post']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/users/{user_id}': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    post?: never
    delete?: never
    options?: never
    head?: never
    /** Update User */
    patch: operations['update_user_api_v1_users__user_id__patch']
    trace?: never
  }
  '/api/v1/users/{user_id}/approve': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    /**
     * Approve User
     * @description Asigna un rol a una cuenta «Pendiente de aprobación».
     */
    post: operations['approve_user_api_v1_users__user_id__approve_post']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
  '/api/v1/users/{user_id}/reset-password': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    /** Reset Password */
    post: operations['reset_password_api_v1_users__user_id__reset_password_post']
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
}
export type webhooks = Record<string, never>
export interface components {
  schemas: {
    /** ActivityOption */
    ActivityOption: {
      /**
       * Category
       * @enum {string}
       */
      category:
        | 'fisioterapia'
        | 'arteterapia'
        | 'fonoaudiologia'
        | 'psicologia'
        | 'teatro'
        | 'familias'
        | 'comunitario'
      /** Label */
      label: string
      /** Patients */
      patients: number
    }
    /** ActivityTag */
    ActivityTag: {
      /**
       * Category
       * @enum {string}
       */
      category:
        | 'fisioterapia'
        | 'arteterapia'
        | 'fonoaudiologia'
        | 'psicologia'
        | 'teatro'
        | 'familias'
        | 'comunitario'
      /** Label */
      label: string
    }
    /** AlbumIn */
    AlbumIn: {
      /**
       * Description
       * @default
       */
      description?: string
      /** Scheduleid */
      scheduleId?: string | null
      /** Title */
      title: string
    }
    /** AlbumOut */
    AlbumOut: {
      /** Assetcount */
      assetCount: number
      /** Assets */
      assets: components['schemas']['AssetOut'][]
      /** Coverurl */
      coverUrl: string | null
      /**
       * Createdat
       * Format: date-time
       */
      createdAt: string
      /** Description */
      description: string
      /**
       * Id
       * Format: uuid
       */
      id: string
      /** Permissionsreviewed */
      permissionsReviewed: boolean
      /** Reviewedat */
      reviewedAt: string | null
      /** Scheduleid */
      scheduleId: string | null
      /** Title */
      title: string
      /**
       * Visibility
       * @enum {string}
       */
      visibility: 'privado' | 'publico'
      /** Warnings */
      warnings: components['schemas']['PermissionWarning'][]
    }
    /** AlbumPublish */
    AlbumPublish: {
      /** Permissionsreviewed */
      permissionsReviewed: boolean
    }
    /** AlbumSummaryOut */
    AlbumSummaryOut: {
      /** Assetcount */
      assetCount: number
      /** Coverurl */
      coverUrl: string | null
      /**
       * Createdat
       * Format: date-time
       */
      createdAt: string
      /** Description */
      description: string
      /**
       * Id
       * Format: uuid
       */
      id: string
      /** Permissionsreviewed */
      permissionsReviewed: boolean
      /** Scheduleid */
      scheduleId: string | null
      /** Title */
      title: string
      /**
       * Visibility
       * @enum {string}
       */
      visibility: 'privado' | 'publico'
    }
    /** AlbumUpdate */
    AlbumUpdate: {
      /** Description */
      description?: string | null
      /** Scheduleid */
      scheduleId?: string | null
      /** Title */
      title?: string | null
    }
    /** AreaCount */
    AreaCount: {
      /**
       * Area
       * @enum {string}
       */
      area:
        | 'afiliados'
        | 'accesos'
        | 'donaciones'
        | 'solicitudes'
        | 'equipo'
        | 'actividades'
        | 'inventario'
        | 'sitio'
      /** Count */
      count: number
      /** Label */
      label: string
    }
    /**
     * AssetIn
     * @description Lo que devolvió Cloudinary al terminar la subida.
     */
    AssetIn: {
      /** Height */
      height?: number | null
      /**
       * Kind
       * @enum {string}
       */
      kind: 'imagen' | 'video'
      /** Publicid */
      publicId: string
      /** Sizebytes */
      sizeBytes: number
      /** Thumbnailurl */
      thumbnailUrl?: string | null
      /** Url */
      url: string
      /** Width */
      width?: number | null
    }
    /** AssetOut */
    AssetOut: {
      /** Height */
      height: number | null
      /**
       * Id
       * Format: uuid
       */
      id: string
      /**
       * Kind
       * @enum {string}
       */
      kind: 'imagen' | 'video'
      /** Sizebytes */
      sizeBytes: number
      /** Tags */
      tags: components['schemas']['TagOut'][]
      /** Thumbnailurl */
      thumbnailUrl: string | null
      /**
       * Uploadedat
       * Format: date-time
       */
      uploadedAt: string
      /** Url */
      url: string
      /** Width */
      width: number | null
    }
    /** AttendanceActivity */
    AttendanceActivity: {
      /**
       * Date
       * Format: date
       */
      date: string
      /**
       * Endtime
       * Format: time
       */
      endTime: string
      /**
       * Id
       * Format: uuid
       */
      id: string
      /** Location */
      location: string
      /** Professionalname */
      professionalName: string
      /**
       * Starttime
       * Format: time
       */
      startTime: string
      /** Status */
      status: string
      /** Title */
      title: string
    }
    /** AttendanceEntryOut */
    AttendanceEntryOut: {
      /** Markedat */
      markedAt: string | null
      /** Name */
      name: string
      /** Note */
      note: string
      /**
       * Patientid
       * Format: uuid
       */
      patientId: string
      /**
       * Status
       * @enum {string}
       */
      status: 'vino' | 'no_vino' | 'sin_marcar'
    }
    /** AttendanceMark */
    AttendanceMark: {
      /** Note */
      note?: string | null
      /**
       * Status
       * @enum {string}
       */
      status: 'vino' | 'no_vino' | 'sin_marcar'
    }
    /**
     * AttendanceSheetOut
     * @description La planilla del día: quiénes están en la lista y qué se marcó.
     */
    AttendanceSheetOut: {
      activity: components['schemas']['AttendanceActivity']
      /** Closed */
      closed: boolean
      /** Closedat */
      closedAt: string | null
      /** Items */
      items: components['schemas']['AttendanceEntryOut'][]
      summary: components['schemas']['AttendanceSummary']
    }
    /** AttendanceSummary */
    AttendanceSummary: {
      /** Came */
      came: number
      /** Notcame */
      notCame: number
      /** Total */
      total: number
      /** Unmarked */
      unmarked: number
    }
    /** AuditEventOut */
    AuditEventOut: {
      /** Action */
      action: string
      /** Actor */
      actor: string
      /** Actorname */
      actorName: string | null
      /** Actorrole */
      actorRole: string
      /** Area */
      area:
        | (
            | 'afiliados'
            | 'accesos'
            | 'donaciones'
            | 'solicitudes'
            | 'equipo'
            | 'actividades'
            | 'inventario'
            | 'sitio'
          )
        | null
      /** Arealabel */
      areaLabel: string | null
      /** Category */
      category: string
      /**
       * Date
       * Format: date-time
       */
      date: string
      /** Detail */
      detail: string
      /**
       * Id
       * Format: uuid
       */
      id: string
      /** Ipaddress */
      ipAddress: string | null
      /**
       * Lastoccurredat
       * Format: date-time
       */
      lastOccurredAt: string
      /** Occurrences */
      occurrences: number
      /** Review */
      review: ('acceso_bloqueado' | 'aporte_anulado') | null
      /** Severity */
      severity: string
    }
    /**
     * AuditPage
     * @description Página de la bitácora (lo más reciente primero).
     */
    AuditPage: {
      /** Items */
      items: components['schemas']['AuditEventOut'][]
      /** Limit */
      limit: number
      /** Offset */
      offset: number
      /**
       * Total
       * @description Filas que cumplen los filtros (todas las páginas)
       */
      total: number
    }
    /**
     * AuditSummary
     * @description Resumen del período: movimientos por área y situaciones para revisar.
     */
    AuditSummary: {
      /** Areas */
      areas: components['schemas']['AreaCount'][]
      /**
       * Datefrom
       * Format: date-time
       */
      dateFrom: string
      /** Days */
      days: number
      review: components['schemas']['ReviewCounts']
    }
    /** Body_upload_document_api_v1_patients__patient_id__documents_post */
    Body_upload_document_api_v1_patients__patient_id__documents_post: {
      /** Documenttype */
      documentType: string
      /** File */
      file: string
    }
    /** ChangePasswordRequest */
    ChangePasswordRequest: {
      /** Currentpassword */
      currentPassword?: string | null
      /** Newpassword */
      newPassword: string
    }
    /** ChannelTotal */
    ChannelTotal: {
      /** Amountbs */
      amountBs: number
      /**
       * Channel
       * @enum {string}
       */
      channel: 'qr_bancario' | 'efectivo' | 'especie'
      /** Label */
      label: string
    }
    /** ClinicalAnamnesis */
    ClinicalAnamnesis: {
      /**
       * Diagnosis
       * @default Enfermedad de Parkinson
       */
      diagnosis?: string
      /**
       * Medications
       * @default
       */
      medications?: string
      /**
       * Neurologistcertificate
       * @default false
       */
      neurologistCertificate?: boolean
      /**
       * Stage
       * @default Estadio I (Leve unilateral)
       */
      stage?: string
      /**
       * Symptomnotes
       * @default
       */
      symptomNotes?: string
    }
    /** ClinicalAnamnesisUpdate */
    ClinicalAnamnesisUpdate: {
      /** Diagnosis */
      diagnosis?: string | null
      /** Medications */
      medications?: string | null
      /** Neurologistcertificate */
      neurologistCertificate?: boolean | null
      /** Stage */
      stage?: string | null
      /** Symptomnotes */
      symptomNotes?: string | null
    }
    /** ContactIn */
    ContactIn: {
      /** Altphone */
      altPhone?: string | null
      /**
       * Isprimary
       * @default false
       */
      isPrimary?: boolean
      /** Name */
      name: string
      /** Phone */
      phone: string
      /** Relation */
      relation: string
    }
    /** ContactOut */
    ContactOut: {
      /** Altphone */
      altPhone: string | null
      /**
       * Id
       * Format: uuid
       */
      id: string
      /** Isprimary */
      isPrimary: boolean
      /** Name */
      name: string
      /** Phone */
      phone: string
      /** Relation */
      relation: string
    }
    /**
     * ContactUpdate
     * @description PATCH de un familiar o cuidador: solo los campos enviados.
     */
    ContactUpdate: {
      /** Altphone */
      altPhone?: string | null
      /** Isprimary */
      isPrimary?: boolean | null
      /** Name */
      name?: string | null
      /** Phone */
      phone?: string | null
      /** Relation */
      relation?: string | null
    }
    /** DashboardSummary */
    DashboardSummary: {
      /** Attendancelastsaturdays */
      attendanceLastSaturdays:
        components['schemas']['SaturdayAttendance'][] | null
      nextActivity: components['schemas']['NextActivity'] | null
      patients: components['schemas']['PatientsOverview'] | null
      toReview: components['schemas']['ToReview']
      /** Upcoming */
      upcoming: components['schemas']['UpcomingActivity'][] | null
    }
    /** DonationCancel */
    DonationCancel: {
      /** Reason */
      reason: string
    }
    /** DonationConfirm */
    DonationConfirm: {
      /** Bankreference */
      bankReference: string
      /**
       * Creditedon
       * Format: date
       */
      creditedOn: string
    }
    /**
     * DonationManualIn
     * @description «Registrar un aporte recibido» en la sede (diseño pág. 16).
     */
    DonationManualIn: {
      /**
       * Addtoinventory
       * @default true
       */
      addToInventory?: boolean
      /** Amountbs */
      amountBs?: number | string | null
      /**
       * Category
       * @default otro
       * @enum {string}
       */
      category?:
        'fisioterapia' | 'movilidad' | 'mobiliario' | 'papeleria' | 'otro'
      /**
       * Channel
       * @enum {string}
       */
      channel: 'efectivo' | 'especie'
      /**
       * Condition
       * @default bueno
       * @enum {string}
       */
      condition?: 'nuevo' | 'bueno' | 'regular' | 'dañado'
      /** Date */
      date?: string | null
      /** Donorcontact */
      donorContact?: string | null
      /** Donorname */
      donorName?: string | null
      /** Estimatedvaluebs */
      estimatedValueBs?: number | string | null
      /** Inkinddescription */
      inKindDescription?: string | null
      /**
       * Purpose
       * @default Donde más se necesite
       */
      purpose?: string
      /**
       * Quantity
       * @default 1
       */
      quantity?: number
      /** Receiptnumber */
      receiptNumber?: string | null
    }
    /**
     * DonationNoticeIn
     * @description «Avísanos de tu aporte» (diseño pág. 4): el aporte ya se hizo por QR bancario.
     */
    DonationNoticeIn: {
      /** Amountbs */
      amountBs: number | string
      /** Declaredreference */
      declaredReference?: string | null
      /** Donorcontact */
      donorContact?: string | null
      /** Donorname */
      donorName?: string | null
      /**
       * Purpose
       * @default Donde más se necesite
       */
      purpose?: string
      /** Turnstiletoken */
      turnstileToken: string
    }
    /** DonationOut */
    DonationOut: {
      /** Amountbs */
      amountBs: number | null
      /** Bankreference */
      bankReference: string | null
      /** Cancellationreason */
      cancellationReason: string | null
      /**
       * Channel
       * @enum {string}
       */
      channel: 'qr_bancario' | 'efectivo' | 'especie'
      /** Channellabel */
      channelLabel: string
      /**
       * Createdat
       * Format: date-time
       */
      createdAt: string
      /** Creditedon */
      creditedOn: string | null
      /**
       * Date
       * Format: date
       */
      date: string
      /** Declaredreference */
      declaredReference: string | null
      /** Donorcontact */
      donorContact: string | null
      /** Donorname */
      donorName: string | null
      /** Estimatedvaluebs */
      estimatedValueBs: number | null
      /**
       * Id
       * Format: uuid
       */
      id: string
      /** Inkinddescription */
      inKindDescription: string | null
      /** Inventoryitemid */
      inventoryItemId: string | null
      /** Purpose */
      purpose: string
      /** Reviewedat */
      reviewedAt: string | null
      /**
       * Source
       * @enum {string}
       */
      source: 'sitio' | 'sede'
      /**
       * Status
       * @enum {string}
       */
      status: 'pendiente' | 'confirmado' | 'recibido' | 'anulado'
      /** Statuslabel */
      statusLabel: string
    }
    /**
     * DonationPage
     * @description Página del registro de aportes.
     */
    DonationPage: {
      /** Items */
      items: components['schemas']['DonationOut'][]
      /** Limit */
      limit: number
      /** Offset */
      offset: number
      /**
       * Total
       * @description Filas que cumplen los filtros (todas las páginas)
       */
      total: number
    }
    /**
     * DonationSummary
     * @description «Este mes llegaron…» (diseño pág. 15).
     */
    DonationSummary: {
      /** Bychannel */
      byChannel: components['schemas']['ChannelTotal'][]
      /** Cancelledcount */
      cancelledCount: number
      /** Confirmedbs */
      confirmedBs: number
      /** Confirmedcount */
      confirmedCount: number
      /** Inkindcount */
      inKindCount: number
      /** Month */
      month: string
      /** Pendingcount */
      pendingCount: number
    }
    /**
     * DonationTrackingOut
     * @description En qué paso está el aporte (diseño pág. 5), sin datos de quien donó.
     */
    DonationTrackingOut: {
      /** Amountbs */
      amountBs: number
      /**
       * Createdat
       * Format: date-time
       */
      createdAt: string
      /**
       * Id
       * Format: uuid
       */
      id: string
      /**
       * Status
       * @enum {string}
       */
      status: 'pendiente' | 'confirmado' | 'recibido' | 'anulado'
      /** Statuslabel */
      statusLabel: string
    }
    /** EmailRequest */
    EmailRequest: {
      /** Email */
      email: string
      /** Turnstiletoken */
      turnstileToken: string
    }
    /** EvaluationIn */
    EvaluationIn: {
      /**
       * Area
       * @enum {string}
       */
      area: 'fisica' | 'fonoaudiologica' | 'psicologica'
      /**
       * Evaluatedon
       * Format: date
       */
      evaluatedOn: string
      /** Notes */
      notes: string
      /** Professionalid */
      professionalId?: string | null
      /** Professionalname */
      professionalName?: string | null
    }
    /** EvaluationOut */
    EvaluationOut: {
      /**
       * Area
       * @enum {string}
       */
      area: 'fisica' | 'fonoaudiologica' | 'psicologica'
      /** Arealabel */
      areaLabel: string
      /**
       * Createdat
       * Format: date-time
       */
      createdAt: string
      /**
       * Evaluatedon
       * Format: date
       */
      evaluatedOn: string
      /**
       * Id
       * Format: uuid
       */
      id: string
      /** Notes */
      notes: string
      /**
       * Patientid
       * Format: uuid
       */
      patientId: string
      /** Professionalid */
      professionalId: string | null
      /** Professionalname */
      professionalName: string
      /**
       * Updatedat
       * Format: date-time
       */
      updatedAt: string
    }
    /**
     * EvaluationRemove
     * @description Quitar una evaluación registrada por error: el motivo queda guardado.
     */
    EvaluationRemove: {
      /** Reason */
      reason: string
    }
    /** EvaluationUpdate */
    EvaluationUpdate: {
      /** Area */
      area?: ('fisica' | 'fonoaudiologica' | 'psicologica') | null
      /** Evaluatedon */
      evaluatedOn?: string | null
      /** Notes */
      notes?: string | null
      /** Professionalid */
      professionalId?: string | null
      /** Professionalname */
      professionalName?: string | null
    }
    /** GoalIn */
    GoalIn: {
      /**
       * Description
       * @default
       */
      description?: string
      /**
       * Manualadjustmentbs
       * @default 0
       */
      manualAdjustmentBs?: number | string
      /** Milestones */
      milestones?: components['schemas']['MilestoneIn'][]
      /** Targetbs */
      targetBs: number | string
      /** Title */
      title: string
      /**
       * Visible
       * @default true
       */
      visible?: boolean
    }
    /** GoalOut */
    GoalOut: {
      /** Confirmedbs */
      confirmedBs: number
      /** Confirmedcount */
      confirmedCount: number
      /** Description */
      description: string
      /**
       * Id
       * Format: uuid
       */
      id: string
      /** Manualadjustmentbs */
      manualAdjustmentBs: number
      /** Milestones */
      milestones: components['schemas']['MilestoneOut'][]
      /** Percent */
      percent: number
      /** Raisedbs */
      raisedBs: number
      /** Targetbs */
      targetBs: number
      /** Title */
      title: string
      /** Visible */
      visible: boolean
    }
    /** GoogleLoginRequest */
    GoogleLoginRequest: {
      /** Credential */
      credential: string
    }
    /** HTTPValidationError */
    HTTPValidationError: {
      /** Detail */
      detail?: components['schemas']['ValidationError'][]
    }
    /**
     * InquiryConvert
     * @description Ficha nueva desde la solicitud; lo que no se envía se toma de la solicitud.
     */
    InquiryConvert: {
      /**
       * Address
       * @default
       */
      address?: string
      /** Birthdate */
      birthDate?: string | null
      /** Ci */
      ci: string
      /** Contacts */
      contacts?: components['schemas']['ContactIn'][]
      /** Name */
      name?: string | null
      /** Phone */
      phone?: string | null
      /** Zone */
      zone?: string | null
    }
    /** InquiryDetailOut */
    InquiryDetailOut: {
      /** Assignedto */
      assignedTo: string | null
      /** Assignedtoname */
      assignedToName: string | null
      /** Contactconsent */
      contactConsent: boolean
      /**
       * Createdat
       * Format: date-time
       */
      createdAt: string
      /**
       * Id
       * Format: uuid
       */
      id: string
      /**
       * Kind
       * @enum {string}
       */
      kind:
        | 'orientacion'
        | 'voluntariado'
        | 'especie'
        | 'participar'
        | 'asistencia'
        | 'otro'
      /** Kindlabel */
      kindLabel: string
      /** Message */
      message: string
      /** Name */
      name: string
      /** Notes */
      notes: components['schemas']['NoteOut'][]
      /** Onbehalfof */
      onBehalfOf: string
      /** Patientid */
      patientId: string | null
      /** Phone */
      phone: string
      /** Preferredcalltime */
      preferredCallTime: string
      /** Scheduleid */
      scheduleId: string | null
      /** Scheduletitle */
      scheduleTitle: string | null
      /**
       * Source
       * @enum {string}
       */
      source: 'sitio' | 'asistencia' | 'sede'
      /**
       * Status
       * @enum {string}
       */
      status:
        'recibida' | 'por_contactar' | 'contactada' | 'inscrita' | 'cerrada'
      /** Statuslabel */
      statusLabel: string
      /**
       * Updatedat
       * Format: date-time
       */
      updatedAt: string
      /** Zone */
      zone: string
    }
    /** InquiryOut */
    InquiryOut: {
      /** Assignedto */
      assignedTo: string | null
      /** Assignedtoname */
      assignedToName: string | null
      /** Contactconsent */
      contactConsent: boolean
      /**
       * Createdat
       * Format: date-time
       */
      createdAt: string
      /**
       * Id
       * Format: uuid
       */
      id: string
      /**
       * Kind
       * @enum {string}
       */
      kind:
        | 'orientacion'
        | 'voluntariado'
        | 'especie'
        | 'participar'
        | 'asistencia'
        | 'otro'
      /** Kindlabel */
      kindLabel: string
      /** Message */
      message: string
      /** Name */
      name: string
      /** Onbehalfof */
      onBehalfOf: string
      /** Patientid */
      patientId: string | null
      /** Phone */
      phone: string
      /** Preferredcalltime */
      preferredCallTime: string
      /** Scheduleid */
      scheduleId: string | null
      /** Scheduletitle */
      scheduleTitle: string | null
      /**
       * Source
       * @enum {string}
       */
      source: 'sitio' | 'asistencia' | 'sede'
      /**
       * Status
       * @enum {string}
       */
      status:
        'recibida' | 'por_contactar' | 'contactada' | 'inscrita' | 'cerrada'
      /** Statuslabel */
      statusLabel: string
      /**
       * Updatedat
       * Format: date-time
       */
      updatedAt: string
      /** Zone */
      zone: string
    }
    /**
     * InquiryPage
     * @description Página de la bandeja de solicitudes.
     */
    InquiryPage: {
      /** Items */
      items: components['schemas']['InquiryOut'][]
      /** Limit */
      limit: number
      /** Offset */
      offset: number
      /**
       * Total
       * @description Filas que cumplen los filtros (todas las páginas)
       */
      total: number
    }
    /**
     * InquirySummary
     * @description Contadores de las pestañas de la bandeja.
     */
    InquirySummary: {
      /** Cerrada */
      cerrada: number
      /** Contactada */
      contactada: number
      /** Inscrita */
      inscrita: number
      /** Porcontactar */
      porContactar: number
      /** Recibida */
      recibida: number
      /** Total */
      total: number
    }
    /** InquiryUpdate */
    InquiryUpdate: {
      /** Assignedto */
      assignedTo?: string | null
      /** Status */
      status?:
        | ('recibida' | 'por_contactar' | 'contactada' | 'inscrita' | 'cerrada')
        | null
    }
    /**
     * InventorySummary
     * @description Contadores del encabezado (diseño pág. 11): materiales activos, no unidades.
     */
    InventorySummary: {
      /** Alcaldia */
      alcaldia: number
      /** Damaged */
      damaged: number
      /** Donado */
      donado: number
      /** Propio */
      propio: number
      /** Total */
      total: number
    }
    /** ItemDeactivate */
    ItemDeactivate: {
      /** Reason */
      reason: string
    }
    /** ItemIn */
    ItemIn: {
      /**
       * Category
       * @enum {string}
       */
      category:
        'fisioterapia' | 'movilidad' | 'mobiliario' | 'papeleria' | 'otro'
      /** Code */
      code?: string | null
      /**
       * Condition
       * @enum {string}
       */
      condition: 'nuevo' | 'bueno' | 'regular' | 'dañado'
      /**
       * Donororinstitution
       * @default
       */
      donorOrInstitution?: string
      /** Entrydate */
      entryDate?: string | null
      /**
       * Location
       * @default
       */
      location?: string
      /** Name */
      name: string
      /**
       * Origin
       * @enum {string}
       */
      origin: 'propio' | 'donado' | 'alcaldia'
      /** Quantity */
      quantity: number
    }
    /** ItemOut */
    ItemOut: {
      /** Active */
      active: boolean
      /**
       * Category
       * @enum {string}
       */
      category:
        'fisioterapia' | 'movilidad' | 'mobiliario' | 'papeleria' | 'otro'
      /** Categorylabel */
      categoryLabel: string
      /** Code */
      code: string | null
      /**
       * Condition
       * @enum {string}
       */
      condition: 'nuevo' | 'bueno' | 'regular' | 'dañado'
      /** Conditionlabel */
      conditionLabel: string
      /**
       * Createdat
       * Format: date-time
       */
      createdAt: string
      /** Deactivationreason */
      deactivationReason: string | null
      /** Donororinstitution */
      donorOrInstitution: string
      /**
       * Entrydate
       * Format: date
       */
      entryDate: string
      /**
       * Id
       * Format: uuid
       */
      id: string
      /** Location */
      location: string
      /** Name */
      name: string
      /**
       * Origin
       * @enum {string}
       */
      origin: 'propio' | 'donado' | 'alcaldia'
      /** Originlabel */
      originLabel: string
      /** Quantity */
      quantity: number
      /**
       * Updatedat
       * Format: date-time
       */
      updatedAt: string
    }
    /**
     * ItemPage
     * @description Página del inventario.
     */
    ItemPage: {
      /** Items */
      items: components['schemas']['ItemOut'][]
      /** Limit */
      limit: number
      /** Offset */
      offset: number
      /**
       * Total
       * @description Filas que cumplen los filtros (todas las páginas)
       */
      total: number
    }
    /** ItemUpdate */
    ItemUpdate: {
      /** Category */
      category?:
        | ('fisioterapia' | 'movilidad' | 'mobiliario' | 'papeleria' | 'otro')
        | null
      /** Code */
      code?: string | null
      /** Condition */
      condition?: ('nuevo' | 'bueno' | 'regular' | 'dañado') | null
      /** Donororinstitution */
      donorOrInstitution?: string | null
      /** Entrydate */
      entryDate?: string | null
      /** Location */
      location?: string | null
      /** Name */
      name?: string | null
      /** Origin */
      origin?: ('propio' | 'donado' | 'alcaldia') | null
      /** Quantity */
      quantity?: number | null
      /** Reason */
      reason?: string | null
    }
    /** LoginRequest */
    LoginRequest: {
      /** Email */
      email: string
      /** Password */
      password: string
    }
    /**
     * MessageResponse
     * @description Respuesta simple con un mensaje para el usuario.
     */
    MessageResponse: {
      /** Message */
      message: string
    }
    /** MilestoneIn */
    MilestoneIn: {
      /** Label */
      label: string
      /**
       * Status
       * @default pendiente
       * @enum {string}
       */
      status?: 'pendiente' | 'en_camino' | 'cubierto'
    }
    /** MilestoneOut */
    MilestoneOut: {
      /** Label */
      label: string
      /**
       * Status
       * @enum {string}
       */
      status: 'pendiente' | 'en_camino' | 'cubierto'
    }
    /** MonthlyActivity */
    MonthlyActivity: {
      /** Came */
      came: number
      /** Categorylabel */
      categoryLabel: string
      /** Closed */
      closed: boolean
      /**
       * Date
       * Format: date
       */
      date: string
      /** Notcame */
      notCame: number
      /**
       * Scheduleid
       * Format: uuid
       */
      scheduleId: string
      /** Title */
      title: string
    }
    /** MonthlyCategory */
    MonthlyCategory: {
      /** Came */
      came: number
      /** Category */
      category: string
      /** Label */
      label: string
    }
    /** MonthlySummaryOut */
    MonthlySummaryOut: {
      /** Activities */
      activities: components['schemas']['MonthlyActivity'][]
      /** Bycategory */
      byCategory: components['schemas']['MonthlyCategory'][]
      /** Month */
      month: string
      /** Totalcame */
      totalCame: number
    }
    /** MovementIn */
    MovementIn: {
      /**
       * Counterpart
       * @default
       */
      counterpart?: string
      /**
       * Movementtype
       * @enum {string}
       */
      movementType: 'ingreso' | 'prestamo' | 'devolucion' | 'ajuste'
      /** Quantity */
      quantity: number
      /**
       * Reason
       * @default
       */
      reason?: string
    }
    /** MovementOut */
    MovementOut: {
      /** Counterpart */
      counterpart: string
      /**
       * Createdat
       * Format: date-time
       */
      createdAt: string
      /**
       * Id
       * Format: uuid
       */
      id: string
      /** Movementlabel */
      movementLabel: string
      /**
       * Movementtype
       * @enum {string}
       */
      movementType: 'ingreso' | 'prestamo' | 'devolucion' | 'baja' | 'ajuste'
      /** Quantitydelta */
      quantityDelta: number
      /** Reason */
      reason: string
      /** Username */
      userName: string | null
    }
    /**
     * NewcomerIn
     * @description Persona que llegó por primera vez y no tiene ficha («Anotar persona nueva»).
     */
    NewcomerIn: {
      /**
       * Contactconsent
       * @default false
       */
      contactConsent?: boolean
      /** Name */
      name: string
      /**
       * Note
       * @default
       */
      note?: string
      /**
       * Onbehalfof
       * @default
       */
      onBehalfOf?: string
      /** Phone */
      phone: string
    }
    /** NewcomerOut */
    NewcomerOut: {
      /**
       * Inquiryid
       * Format: uuid
       */
      inquiryId: string
      /** Message */
      message: string
    }
    /** NextActivity */
    NextActivity: {
      /**
       * Date
       * Format: date
       */
      date: string
      /**
       * Endtime
       * Format: time
       */
      endTime: string
      /**
       * Id
       * Format: uuid
       */
      id: string
      /** Location */
      location: string
      /** Newsignups */
      newSignups: number
      /** Professionalname */
      professionalName: string
      /**
       * Starttime
       * Format: time
       */
      startTime: string
      /** Title */
      title: string
      /** Usualattendance */
      usualAttendance: number | null
    }
    /** NoteIn */
    NoteIn: {
      /**
       * Markcontacted
       * @default false
       */
      markContacted?: boolean
      /** Note */
      note: string
    }
    /** NoteOut */
    NoteOut: {
      /** Authorname */
      authorName: string
      /**
       * Createdat
       * Format: date-time
       */
      createdAt: string
      /**
       * Id
       * Format: uuid
       */
      id: string
      /** Note */
      note: string
    }
    /** PasswordResetOut */
    PasswordResetOut: {
      /** Message */
      message: string
      /** Temporarypassword */
      temporaryPassword: string
    }
    /**
     * PatientAttendancePage
     * @description Asistencia de un afiliado (pestaña Asistencia de su ficha, diseño pág. 9).
     */
    PatientAttendancePage: {
      /** Items */
      items: components['schemas']['PatientAttendanceRecord'][]
      /** Limit */
      limit: number
      /** Offset */
      offset: number
      /**
       * Quarterlabel
       * @description Trimestre en curso, por ejemplo «octubre a diciembre de 2026»
       */
      quarterLabel: string
      /**
       * Quarterstart
       * Format: date
       */
      quarterStart: string
      /** Saturdaysattended */
      saturdaysAttended: number
      /** Saturdaysheld */
      saturdaysHeld: number
      /**
       * Total
       * @description Filas que cumplen los filtros (todas las páginas)
       */
      total: number
    }
    /** PatientAttendanceRecord */
    PatientAttendanceRecord: {
      /** Category */
      category: string
      /** Categorylabel */
      categoryLabel: string
      /**
       * Date
       * Format: date
       */
      date: string
      /** Note */
      note: string
      /**
       * Scheduleid
       * Format: uuid
       */
      scheduleId: string
      /**
       * Status
       * @enum {string}
       */
      status: 'vino' | 'no_vino'
      /** Title */
      title: string
    }
    /**
     * PatientCounts
     * @description Contadores de las pestañas del listado y opciones del filtro por actividad.
     */
    PatientCounts: {
      /** Active */
      active: number
      /** Activities */
      activities: components['schemas']['ActivityOption'][]
      /** All */
      all: number
      /** Consentpending */
      consentPending: number
      /** Inactive */
      inactive: number
    }
    /** PatientDeactivate */
    PatientDeactivate: {
      /** Reason */
      reason: string
    }
    /** PatientDocumentOut */
    PatientDocumentOut: {
      /** Contenttype */
      contentType: string
      /** Documenttype */
      documentType: string
      /** Filename */
      fileName: string
      /**
       * Id
       * Format: uuid
       */
      id: string
      /**
       * Patientid
       * Format: uuid
       */
      patientId: string
      /** Sizebytes */
      sizeBytes: number
      /**
       * Uploadedat
       * Format: date-time
       */
      uploadedAt: string
    }
    /**
     * PatientDraftOut
     * @description Datos para precargar la ficha nueva al «Inscribir como afiliado».
     */
    PatientDraftOut: {
      /** Contacts */
      contacts: components['schemas']['ContactIn'][]
      /** Name */
      name: string
      /** Phone */
      phone: string
      /** Zone */
      zone: string
    }
    /**
     * PatientIn
     * @description Alta de una ficha; las reglas de negocio se validan en el servicio.
     */
    PatientIn: {
      /**
       * Accessstatus
       * @default Pendiente
       */
      accessStatus?: string
      /**
       * Address
       * @default
       */
      address?: string
      anamnesis?: components['schemas']['ClinicalAnamnesis'] | null
      /** Birthdate */
      birthDate?: string | null
      /** Ci */
      ci: string
      /**
       * Consent
       * @default false
       */
      consent?: boolean
      /** Consentdate */
      consentDate?: string | null
      /** Contacts */
      contacts: components['schemas']['ContactIn'][]
      /**
       * Imageconsent
       * @default false
       */
      imageConsent?: boolean
      /** Name */
      name: string
      /** Phone */
      phone: string
      /**
       * Zone
       * @default
       */
      zone?: string
    }
    /** PatientOut */
    PatientOut: {
      /** Accessstatus */
      accessStatus: string
      /** Active */
      active: boolean
      /** Address */
      address: string
      anamnesis: components['schemas']['ClinicalAnamnesis']
      /** Birthdate */
      birthDate: string | null
      /** Ci */
      ci: string
      /** Clinicalaccess */
      clinicalAccess: boolean
      /** Consent */
      consent: boolean
      /** Consentdate */
      consentDate: string | null
      /** Contacts */
      contacts: components['schemas']['ContactOut'][]
      /**
       * Createdat
       * Format: date-time
       */
      createdAt: string
      /** Deactivationreason */
      deactivationReason: string | null
      /**
       * Id
       * Format: uuid
       */
      id: string
      /** Imageconsent */
      imageConsent: boolean
      /** Name */
      name: string
      /** Phone */
      phone: string
      /**
       * Updatedat
       * Format: date-time
       */
      updatedAt: string
      /** Zone */
      zone: string
    }
    /**
     * PatientPage
     * @description Página del listado de afiliados.
     */
    PatientPage: {
      /** Items */
      items: components['schemas']['PatientSummaryOut'][]
      /** Limit */
      limit: number
      /** Offset */
      offset: number
      /**
       * Total
       * @description Filas que cumplen los filtros (todas las páginas)
       */
      total: number
    }
    /**
     * PatientReactivate
     * @description Volver a activar una ficha también deja escrito el motivo (queda en la bitácora).
     */
    PatientReactivate: {
      /** Reason */
      reason: string
    }
    /**
     * PatientSummaryOut
     * @description Fila del listado: sin anamnesis (S5). La ficha clínica completa solo se obtiene con
     *     GET /patients/{id}, que queda en la bitácora.
     */
    PatientSummaryOut: {
      /** Accessstatus */
      accessStatus: string
      /** Active */
      active: boolean
      /** Activities */
      activities: components['schemas']['ActivityTag'][]
      /** Ci */
      ci: string
      /** Consent */
      consent: boolean
      /**
       * Createdat
       * Format: date-time
       */
      createdAt: string
      /**
       * Id
       * Format: uuid
       */
      id: string
      /** Imageconsent */
      imageConsent: boolean
      /** Name */
      name: string
      /** Phone */
      phone: string
      primaryContact: components['schemas']['ContactOut'] | null
      /**
       * Updatedat
       * Format: date-time
       */
      updatedAt: string
      /** Zone */
      zone: string
    }
    /**
     * PatientUpdate
     * @description PATCH parcial: solo se modifican los campos enviados.
     */
    PatientUpdate: {
      /** Accessstatus */
      accessStatus?: string | null
      /** Address */
      address?: string | null
      anamnesis?: components['schemas']['ClinicalAnamnesisUpdate'] | null
      /** Birthdate */
      birthDate?: string | null
      /** Ci */
      ci?: string | null
      /** Consent */
      consent?: boolean | null
      /** Consentdate */
      consentDate?: string | null
      /** Imageconsent */
      imageConsent?: boolean | null
      /** Name */
      name?: string | null
      /** Phone */
      phone?: string | null
      /** Zone */
      zone?: string | null
    }
    /** PatientsOverview */
    PatientsOverview: {
      /** Active */
      active: number
      /** Joinedthismonth */
      joinedThisMonth: number
      /** Withoutconsent */
      withoutConsent: number
    }
    /** PermissionOut */
    PermissionOut: {
      /** Description */
      description: string
      /** Issensitive */
      isSensitive: boolean
      /**
       * Key
       * @enum {string}
       */
      key:
        | 'patients:read'
        | 'patients:write'
        | 'patients:read_clinical'
        | 'patients:write_clinical'
        | 'patients:deactivate'
        | 'documents:upload'
        | 'documents:delete'
        | 'attendance:write'
        | 'schedules:manage'
        | 'inventory:manage'
        | 'donations:manage'
        | 'inquiries:manage'
        | 'media:manage'
        | 'content:manage'
        | 'users:manage'
        | 'roles:manage'
        | 'audit:read'
    }
    /** PermissionWarning */
    PermissionWarning: {
      /**
       * Assetid
       * Format: uuid
       */
      assetId: string
      /** Name */
      name: string
      /**
       * Patientid
       * Format: uuid
       */
      patientId: string
    }
    /** PublicAlbumOut */
    PublicAlbumOut: {
      /** Assetcount */
      assetCount: number
      /** Assets */
      assets: components['schemas']['PublicAssetOut'][]
      /** Coverurl */
      coverUrl: string | null
      /** Description */
      description: string
      /**
       * Id
       * Format: uuid
       */
      id: string
      /** Title */
      title: string
    }
    /** PublicAlbumSummaryOut */
    PublicAlbumSummaryOut: {
      /** Assetcount */
      assetCount: number
      /** Coverurl */
      coverUrl: string | null
      /** Description */
      description: string
      /**
       * Id
       * Format: uuid
       */
      id: string
      /** Title */
      title: string
    }
    /** PublicAssetOut */
    PublicAssetOut: {
      /** Height */
      height: number | null
      /**
       * Id
       * Format: uuid
       */
      id: string
      /**
       * Kind
       * @enum {string}
       */
      kind: 'imagen' | 'video'
      /** Thumbnailurl */
      thumbnailUrl: string | null
      /** Url */
      url: string
      /** Width */
      width: number | null
    }
    /** PublicGoalOut */
    PublicGoalOut: {
      /** Confirmedcount */
      confirmedCount: number
      /** Description */
      description: string
      /** Milestones */
      milestones: components['schemas']['MilestoneOut'][]
      /** Percent */
      percent: number
      /** Raisedbs */
      raisedBs: number
      /** Targetbs */
      targetBs: number
      /** Title */
      title: string
    }
    /**
     * PublicInquiryIn
     * @description «No tienes que saber por dónde empezar» y «Quiero participar» (diseño págs. 2 y 17).
     */
    PublicInquiryIn: {
      /** Contactconsent */
      contactConsent: boolean
      /**
       * Kind
       * @enum {string}
       */
      kind: 'orientacion' | 'voluntariado' | 'especie' | 'participar' | 'otro'
      /**
       * Message
       * @default
       */
      message?: string
      /** Name */
      name: string
      /**
       * Onbehalfof
       * @default
       */
      onBehalfOf?: string
      /** Phone */
      phone: string
      /**
       * Preferredcalltime
       * @default
       */
      preferredCallTime?: string
      /** Scheduleid */
      scheduleId?: string | null
      /** Turnstiletoken */
      turnstileToken: string
      /**
       * Zone
       * @default
       */
      zone?: string
    }
    /**
     * PublicScheduleOut
     * @description Lo que se ve en el sitio sin iniciar sesión: sin datos del equipo.
     */
    PublicScheduleOut: {
      /** Availability */
      availability: ('libres' | 'ultimos' | 'completo') | null
      /** Cancellationnote */
      cancellationNote: string | null
      /**
       * Category
       * @enum {string}
       */
      category:
        | 'fisioterapia'
        | 'arteterapia'
        | 'fonoaudiologia'
        | 'psicologia'
        | 'teatro'
        | 'familias'
        | 'comunitario'
      /** Categorylabel */
      categoryLabel: string
      /**
       * Date
       * Format: date
       */
      date: string
      /** Description */
      description: string
      /**
       * Endtime
       * Format: time
       */
      endTime: string
      /**
       * Id
       * Format: uuid
       */
      id: string
      /** Imageurl */
      imageUrl: string | null
      /** Location */
      location: string
      /** Spots */
      spots: number | null
      /**
       * Starttime
       * Format: time
       */
      startTime: string
      /**
       * Status
       * @enum {string}
       */
      status: 'publicada' | 'cancelada'
      /** Title */
      title: string
    }
    /** PublicSectionOut */
    PublicSectionOut: {
      /** Content */
      content: {
        [key: string]: unknown
      }
      /** Key */
      key: string
      /** Publishedat */
      publishedAt: string | null
      /** Title */
      title: string
    }
    /** RegisterRequest */
    RegisterRequest: {
      /** Email */
      email: string
      /** Name */
      name: string
      /** Password */
      password: string
      /** Turnstiletoken */
      turnstileToken: string
    }
    /** ResetPasswordRequest */
    ResetPasswordRequest: {
      /** Password */
      password: string
      /** Token */
      token: string
    }
    /** ReviewCounts */
    ReviewCounts: {
      /** Blockedaccess */
      blockedAccess: number
      /** Cancelleddonations */
      cancelledDonations: number
      /** Total */
      total: number
    }
    /**
     * RoleMatrixOut
     * @description «Qué puede ver cada rol»: columnas = roles, filas = permisos.
     */
    RoleMatrixOut: {
      /** Permissions */
      permissions: components['schemas']['PermissionOut'][]
      /** Roles */
      roles: components['schemas']['RoleOut'][]
    }
    /** RoleOut */
    RoleOut: {
      /** Description */
      description: string
      /** Issystem */
      isSystem: boolean
      /** Key */
      key: string
      /**
       * Members
       * @description Cuentas activas con este rol
       */
      members: number
      /** Name */
      name: string
      /** Permissions */
      permissions: (
        | 'patients:read'
        | 'patients:write'
        | 'patients:read_clinical'
        | 'patients:write_clinical'
        | 'patients:deactivate'
        | 'documents:upload'
        | 'documents:delete'
        | 'attendance:write'
        | 'schedules:manage'
        | 'inventory:manage'
        | 'donations:manage'
        | 'inquiries:manage'
        | 'media:manage'
        | 'content:manage'
        | 'users:manage'
        | 'roles:manage'
        | 'audit:read'
      )[]
    }
    /** RolePermissionsUpdate */
    RolePermissionsUpdate: {
      /**
       * Confirmsensitive
       * @default false
       */
      confirmSensitive?: boolean
      /** Permissions */
      permissions: (
        | 'patients:read'
        | 'patients:write'
        | 'patients:read_clinical'
        | 'patients:write_clinical'
        | 'patients:deactivate'
        | 'documents:upload'
        | 'documents:delete'
        | 'attendance:write'
        | 'schedules:manage'
        | 'inventory:manage'
        | 'donations:manage'
        | 'inquiries:manage'
        | 'media:manage'
        | 'content:manage'
        | 'users:manage'
        | 'roles:manage'
        | 'audit:read'
      )[]
    }
    /** SaturdayAttendance */
    SaturdayAttendance: {
      /** Came */
      came: number
      /**
       * Date
       * Format: date
       */
      date: string
    }
    /** ScheduleCancel */
    ScheduleCancel: {
      /** Note */
      note: string
    }
    /** ScheduleIn */
    ScheduleIn: {
      /**
       * Category
       * @enum {string}
       */
      category:
        | 'fisioterapia'
        | 'arteterapia'
        | 'fonoaudiologia'
        | 'psicologia'
        | 'teatro'
        | 'familias'
        | 'comunitario'
      /**
       * Date
       * Format: date
       */
      date: string
      /**
       * Description
       * @default
       */
      description?: string
      /**
       * Endtime
       * Format: time
       */
      endTime: string
      /** Imageurl */
      imageUrl?: string | null
      /** Location */
      location: string
      /** Professionalid */
      professionalId?: string | null
      /**
       * Professionalname
       * @default
       */
      professionalName?: string
      /**
       * Publish
       * @default false
       */
      publish?: boolean
      /** Spots */
      spots?: number | null
      /**
       * Starttime
       * Format: time
       */
      startTime: string
      /** Title */
      title: string
    }
    /** ScheduleOut */
    ScheduleOut: {
      /** Attendanceclosedat */
      attendanceClosedAt: string | null
      /** Availability */
      availability: ('libres' | 'ultimos' | 'completo') | null
      /** Came */
      came: number
      /** Cancellationnote */
      cancellationNote: string | null
      /**
       * Category
       * @enum {string}
       */
      category:
        | 'fisioterapia'
        | 'arteterapia'
        | 'fonoaudiologia'
        | 'psicologia'
        | 'teatro'
        | 'familias'
        | 'comunitario'
      /** Categorylabel */
      categoryLabel: string
      /**
       * Createdat
       * Format: date-time
       */
      createdAt: string
      /**
       * Date
       * Format: date
       */
      date: string
      /** Description */
      description: string
      /**
       * Endtime
       * Format: time
       */
      endTime: string
      /**
       * Id
       * Format: uuid
       */
      id: string
      /** Imageurl */
      imageUrl: string | null
      /** Interested */
      interested: number
      /** Location */
      location: string
      /** Professionalid */
      professionalId: string | null
      /** Professionalname */
      professionalName: string
      /** Spots */
      spots: number | null
      /**
       * Starttime
       * Format: time
       */
      startTime: string
      /**
       * Status
       * @enum {string}
       */
      status: 'borrador' | 'publicada' | 'cancelada'
      /** Title */
      title: string
      /**
       * Updatedat
       * Format: date-time
       */
      updatedAt: string
    }
    /**
     * SchedulePage
     * @description Página de la agenda interna.
     */
    SchedulePage: {
      /** Items */
      items: components['schemas']['ScheduleOut'][]
      /** Limit */
      limit: number
      /** Offset */
      offset: number
      /**
       * Total
       * @description Filas que cumplen los filtros (todas las páginas)
       */
      total: number
    }
    /** ScheduleUpdate */
    ScheduleUpdate: {
      /** Category */
      category?:
        | (
            | 'fisioterapia'
            | 'arteterapia'
            | 'fonoaudiologia'
            | 'psicologia'
            | 'teatro'
            | 'familias'
            | 'comunitario'
          )
        | null
      /** Date */
      date?: string | null
      /** Description */
      description?: string | null
      /** Endtime */
      endTime?: string | null
      /** Imageurl */
      imageUrl?: string | null
      /** Location */
      location?: string | null
      /** Professionalid */
      professionalId?: string | null
      /** Professionalname */
      professionalName?: string | null
      /** Spots */
      spots?: number | null
      /** Starttime */
      startTime?: string | null
      /** Title */
      title?: string | null
    }
    /** SectionDraftIn */
    SectionDraftIn: {
      /** Content */
      content: {
        [key: string]: unknown
      }
      /** Title */
      title?: string | null
    }
    /** SectionOut */
    SectionOut: {
      /** Draftcontent */
      draftContent: {
        [key: string]: unknown
      }
      /** Draftupdatedat */
      draftUpdatedAt: string | null
      /** Hasunpublishedchanges */
      hasUnpublishedChanges: boolean
      /** Key */
      key: string
      /** Publishedat */
      publishedAt: string | null
      /** Publishedcontent */
      publishedContent: {
        [key: string]: unknown
      } | null
      /** Title */
      title: string
    }
    /**
     * SessionOut
     * @description Estado de la sesión. El token viaja solo en la cookie HttpOnly aspar_session.
     */
    SessionOut: {
      /** Csrftoken */
      csrfToken: string
      /** Expiresin */
      expiresIn: number
      /** Idletimeout */
      idleTimeout: number
      /** Permissions */
      permissions: (
        | 'patients:read'
        | 'patients:write'
        | 'patients:read_clinical'
        | 'patients:write_clinical'
        | 'patients:deactivate'
        | 'documents:upload'
        | 'documents:delete'
        | 'attendance:write'
        | 'schedules:manage'
        | 'inventory:manage'
        | 'donations:manage'
        | 'inquiries:manage'
        | 'media:manage'
        | 'content:manage'
        | 'users:manage'
        | 'roles:manage'
        | 'audit:read'
      )[]
      user: components['schemas']['SessionUserOut']
    }
    /**
     * SessionUserOut
     * @description Datos del usuario que inició sesión.
     */
    SessionUserOut: {
      /** Active */
      active: boolean
      /** Department */
      department: string
      /** Email */
      email: string
      /** Emailverified */
      emailVerified: boolean
      /** Googlelinked */
      googleLinked: boolean
      /** Haspassword */
      hasPassword: boolean
      /**
       * Id
       * Format: uuid
       */
      id: string
      /** Mustchangepassword */
      mustChangePassword: boolean
      /** Name */
      name: string
      /** Role */
      role: string | null
      /** Rolename */
      roleName: string
    }
    /** SignedUrlOut */
    SignedUrlOut: {
      /** Expiresin */
      expiresIn: number
      /** Url */
      url: string
    }
    /**
     * SocialLinksIn
     * @description «Redes sociales» (diseño pág. 14): vacío = ese ícono no aparece en el sitio.
     */
    SocialLinksIn: {
      /**
       * Facebook
       * @default
       */
      facebook?: string
      /**
       * Instagram
       * @default
       */
      instagram?: string
      /**
       * Tiktok
       * @default
       */
      tiktok?: string
    }
    /** TagOut */
    TagOut: {
      /** Imageconsent */
      imageConsent: boolean
      /** Name */
      name: string
      /**
       * Patientid
       * Format: uuid
       */
      patientId: string
    }
    /** TagsIn */
    TagsIn: {
      /** Patientids */
      patientIds: string[]
    }
    /**
     * ToReview
     * @description «Para revisar».
     */
    ToReview: {
      /** Damageditems */
      damagedItems: number | null
      /** Donationstoconfirm */
      donationsToConfirm: number | null
      /** Newinquiries */
      newInquiries: number | null
      /** Patientswithoutconsent */
      patientsWithoutConsent: number | null
    }
    /** TokenRequest */
    TokenRequest: {
      /** Token */
      token: string
    }
    /** UpcomingActivity */
    UpcomingActivity: {
      /** Cancellationnote */
      cancellationNote: string | null
      /**
       * Date
       * Format: date
       */
      date: string
      /**
       * Endtime
       * Format: time
       */
      endTime: string
      /**
       * Id
       * Format: uuid
       */
      id: string
      /** Location */
      location: string
      /**
       * Starttime
       * Format: time
       */
      startTime: string
      /** Status */
      status: string
      /** Title */
      title: string
    }
    /**
     * UploadSignatureOut
     * @description Datos para subir un archivo directo a Cloudinary desde el navegador.
     */
    UploadSignatureOut: {
      /** Allowedformats */
      allowedFormats: string
      /** Apikey */
      apiKey: string
      /** Cloudname */
      cloudName: string
      /** Folder */
      folder: string
      /** Signature */
      signature: string
      /** Timestamp */
      timestamp: number
      /** Uploadurl */
      uploadUrl: string
    }
    /**
     * UserApprove
     * @description Rol (y área) con que se aprueba una cuenta pendiente.
     */
    UserApprove: {
      /** Department */
      department?: string | null
      /** Role */
      role: string
    }
    /** UserCreate */
    UserCreate: {
      /**
       * Department
       * @default General
       */
      department?: string
      /** Email */
      email: string
      /** Name */
      name: string
      /** Role */
      role: string
    }
    /** UserCreated */
    UserCreated: {
      /** Active */
      active: boolean
      /**
       * Createdat
       * Format: date-time
       */
      createdAt: string
      /** Department */
      department: string
      /** Email */
      email: string
      /** Emailverified */
      emailVerified: boolean
      /**
       * Id
       * Format: uuid
       */
      id: string
      /** Lastloginat */
      lastLoginAt: string | null
      /** Mustchangepassword */
      mustChangePassword: boolean
      /** Name */
      name: string
      /** Role */
      role: string | null
      /** Rolename */
      roleName: string
      /** Temporarypassword */
      temporaryPassword: string
    }
    /** UserOut */
    UserOut: {
      /** Active */
      active: boolean
      /**
       * Createdat
       * Format: date-time
       */
      createdAt: string
      /** Department */
      department: string
      /** Email */
      email: string
      /** Emailverified */
      emailVerified: boolean
      /**
       * Id
       * Format: uuid
       */
      id: string
      /** Lastloginat */
      lastLoginAt: string | null
      /** Mustchangepassword */
      mustChangePassword: boolean
      /** Name */
      name: string
      /** Role */
      role: string | null
      /** Rolename */
      roleName: string
    }
    /**
     * UserPage
     * @description Página del listado del equipo.
     */
    UserPage: {
      /** Items */
      items: components['schemas']['UserOut'][]
      /** Limit */
      limit: number
      /** Offset */
      offset: number
      /**
       * Total
       * @description Filas que cumplen los filtros (todas las páginas)
       */
      total: number
    }
    /** UserUpdate */
    UserUpdate: {
      /** Active */
      active?: boolean | null
      /** Department */
      department?: string | null
      /** Name */
      name?: string | null
      /** Role */
      role?: string | null
    }
    /** ValidationError */
    ValidationError: {
      /** Context */
      ctx?: Record<string, never>
      /** Input */
      input?: unknown
      /** Location */
      loc: (string | number)[]
      /** Message */
      msg: string
      /** Error Type */
      type: string
    }
  }
  responses: never
  parameters: never
  requestBodies: never
  headers: never
  pathItems: never
}
export type $defs = Record<string, never>
export interface operations {
  monthly_summary_api_v1_attendance_monthly_get: {
    parameters: {
      query?: {
        month?: string | null
        format?: 'json' | 'csv' | 'xlsx'
      }
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description JSON, o el archivo CSV / Excel con format=csv o format=xlsx */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['MonthlySummaryOut']
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': unknown
          'text/csv; charset=utf-8': unknown
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  list_audit_events_api_v1_audit_get: {
    parameters: {
      query?: {
        limit?: number
        offset?: number
        category?: string | null
        severity?: string | null
        actor?: string | null
        area?:
          | (
              | 'afiliados'
              | 'accesos'
              | 'donaciones'
              | 'solicitudes'
              | 'equipo'
              | 'actividades'
              | 'inventario'
              | 'sitio'
            )
          | null
        /** @description Persona del equipo (nombre o correo) o afiliado (en el detalle) */
        search?: string | null
        /** @description Últimos N días (si no se indica «from») */
        days?: number | null
        /** @description Solo situaciones para revisar (accesos bloqueados y aportes anulados) */
        review?: boolean
        from?: string | null
        to?: string | null
      }
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['AuditPage']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  export_audit_api_v1_audit_export_get: {
    parameters: {
      query?: {
        format?: 'csv' | 'xlsx'
        category?: string | null
        severity?: string | null
        actor?: string | null
        area?:
          | (
              | 'afiliados'
              | 'accesos'
              | 'donaciones'
              | 'solicitudes'
              | 'equipo'
              | 'actividades'
              | 'inventario'
              | 'sitio'
            )
          | null
        /** @description Persona del equipo (nombre o correo) o afiliado (en el detalle) */
        search?: string | null
        /** @description Últimos N días (si no se indica «from») */
        days?: number | null
        /** @description Solo situaciones para revisar (accesos bloqueados y aportes anulados) */
        review?: boolean
        from?: string | null
        to?: string | null
      }
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': unknown
          'text/csv; charset=utf-8': unknown
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  audit_summary_api_v1_audit_summary_get: {
    parameters: {
      query?: {
        days?: number
      }
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['AuditSummary']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  change_password_api_v1_auth_change_password_post: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['ChangePasswordRequest']
      }
    }
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['SessionOut']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  forgot_password_api_v1_auth_forgot_password_post: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['EmailRequest']
      }
    }
    responses: {
      /** @description Successful Response */
      202: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['MessageResponse']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  login_with_google_api_v1_auth_google_post: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['GoogleLoginRequest']
      }
    }
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['SessionOut']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  login_api_v1_auth_login_post: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['LoginRequest']
      }
    }
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['SessionOut']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  logout_api_v1_auth_logout_post: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['MessageResponse']
        }
      }
    }
  }
  me_api_v1_auth_me_get: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['SessionOut']
        }
      }
    }
  }
  refresh_api_v1_auth_refresh_post: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['SessionOut']
        }
      }
    }
  }
  register_api_v1_auth_register_post: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['RegisterRequest']
      }
    }
    responses: {
      /** @description Successful Response */
      202: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['MessageResponse']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  resend_verification_api_v1_auth_resend_verification_post: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['EmailRequest']
      }
    }
    responses: {
      /** @description Successful Response */
      202: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['MessageResponse']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  reset_password_api_v1_auth_reset_password_post: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['ResetPasswordRequest']
      }
    }
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['MessageResponse']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  verify_email_api_v1_auth_verify_email_post: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['TokenRequest']
      }
    }
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['MessageResponse']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  list_sections_api_v1_content_sections_get: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['SectionOut'][]
        }
      }
    }
  }
  get_section_api_v1_content_sections__key__get: {
    parameters: {
      query?: never
      header?: never
      path: {
        key: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['SectionOut']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  save_draft_api_v1_content_sections__key__put: {
    parameters: {
      query?: never
      header?: never
      path: {
        key: string
      }
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['SectionDraftIn']
      }
    }
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['SectionOut']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  publish_api_v1_content_sections__key__publish_post: {
    parameters: {
      query?: never
      header?: never
      path: {
        key: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['SectionOut']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  save_social_links_api_v1_content_social_links_put: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['SocialLinksIn']
      }
    }
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['SectionOut']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  summary_api_v1_dashboard_summary_get: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['DashboardSummary']
        }
      }
    }
  }
  list_donations_api_v1_donations_get: {
    parameters: {
      query?: {
        status?: ('pendiente' | 'confirmado' | 'recibido' | 'anulado') | null
        channel?: ('qr_bancario' | 'efectivo' | 'especie') | null
        search?: string | null
        from?: string | null
        to?: string | null
        limit?: number
        offset?: number
      }
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['DonationPage']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  register_manual_api_v1_donations_post: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['DonationManualIn']
      }
    }
    responses: {
      /** @description Successful Response */
      201: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['DonationOut']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  get_goal_api_v1_donations_goal_get: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['GoalOut'] | null
        }
      }
    }
  }
  save_goal_api_v1_donations_goal_put: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['GoalIn']
      }
    }
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['GoalOut']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  summary_api_v1_donations_summary_get: {
    parameters: {
      query?: {
        month?: string | null
        format?: 'json' | 'csv' | 'xlsx'
      }
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description JSON, o el archivo CSV / Excel con format=csv o format=xlsx */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['DonationSummary']
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': unknown
          'text/csv; charset=utf-8': unknown
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  get_donation_api_v1_donations__donation_id__get: {
    parameters: {
      query?: never
      header?: never
      path: {
        donation_id: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['DonationOut']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  cancel_api_v1_donations__donation_id__cancel_post: {
    parameters: {
      query?: never
      header?: never
      path: {
        donation_id: string
      }
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['DonationCancel']
      }
    }
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['DonationOut']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  confirm_api_v1_donations__donation_id__confirm_post: {
    parameters: {
      query?: never
      header?: never
      path: {
        donation_id: string
      }
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['DonationConfirm']
      }
    }
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['DonationOut']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  health_api_v1_health_get: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': {
            [key: string]: unknown
          }
        }
      }
    }
  }
  health_db_api_v1_health_db_get: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': {
            [key: string]: unknown
          }
        }
      }
    }
  }
  list_inquiries_api_v1_inquiries_get: {
    parameters: {
      query?: {
        status?:
          | (
              | 'recibida'
              | 'por_contactar'
              | 'contactada'
              | 'inscrita'
              | 'cerrada'
            )
          | null
        kind?:
          | (
              | 'orientacion'
              | 'voluntariado'
              | 'especie'
              | 'participar'
              | 'asistencia'
              | 'otro'
            )
          | null
        search?: string | null
        limit?: number
        offset?: number
      }
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['InquiryPage']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  summary_api_v1_inquiries_summary_get: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['InquirySummary']
        }
      }
    }
  }
  get_inquiry_api_v1_inquiries__inquiry_id__get: {
    parameters: {
      query?: never
      header?: never
      path: {
        inquiry_id: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['InquiryDetailOut']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  update_inquiry_api_v1_inquiries__inquiry_id__patch: {
    parameters: {
      query?: never
      header?: never
      path: {
        inquiry_id: string
      }
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['InquiryUpdate']
      }
    }
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['InquiryDetailOut']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  convert_to_patient_api_v1_inquiries__inquiry_id__convert_to_patient_post: {
    parameters: {
      query?: never
      header?: never
      path: {
        inquiry_id: string
      }
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['InquiryConvert']
      }
    }
    responses: {
      /** @description Successful Response */
      201: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['PatientOut']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  add_note_api_v1_inquiries__inquiry_id__notes_post: {
    parameters: {
      query?: never
      header?: never
      path: {
        inquiry_id: string
      }
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['NoteIn']
      }
    }
    responses: {
      /** @description Successful Response */
      201: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['InquiryDetailOut']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  patient_draft_api_v1_inquiries__inquiry_id__patient_draft_get: {
    parameters: {
      query?: never
      header?: never
      path: {
        inquiry_id: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['PatientDraftOut']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  list_items_api_v1_inventory_get: {
    parameters: {
      query?: {
        search?: string | null
        origin?: ('propio' | 'donado' | 'alcaldia') | null
        category?:
          | ('fisioterapia' | 'movilidad' | 'mobiliario' | 'papeleria' | 'otro')
          | null
        condition?: ('nuevo' | 'bueno' | 'regular' | 'dañado') | null
        includeInactive?: boolean
        limit?: number
        offset?: number
      }
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ItemPage']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  create_item_api_v1_inventory_post: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['ItemIn']
      }
    }
    responses: {
      /** @description Successful Response */
      201: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ItemOut']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  export_inventory_api_v1_inventory_export_get: {
    parameters: {
      query?: {
        format?: 'csv' | 'xlsx'
      }
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Archivo CSV o Excel; los bienes de la Alcaldía van aparte */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': unknown
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': unknown
          'text/csv; charset=utf-8': unknown
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  summary_api_v1_inventory_summary_get: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['InventorySummary']
        }
      }
    }
  }
  get_item_api_v1_inventory__item_id__get: {
    parameters: {
      query?: never
      header?: never
      path: {
        item_id: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ItemOut']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  update_item_api_v1_inventory__item_id__patch: {
    parameters: {
      query?: never
      header?: never
      path: {
        item_id: string
      }
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['ItemUpdate']
      }
    }
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ItemOut']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  deactivate_api_v1_inventory__item_id__deactivate_post: {
    parameters: {
      query?: never
      header?: never
      path: {
        item_id: string
      }
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['ItemDeactivate']
      }
    }
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ItemOut']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  list_movements_api_v1_inventory__item_id__movements_get: {
    parameters: {
      query?: never
      header?: never
      path: {
        item_id: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['MovementOut'][]
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  add_movement_api_v1_inventory__item_id__movements_post: {
    parameters: {
      query?: never
      header?: never
      path: {
        item_id: string
      }
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['MovementIn']
      }
    }
    responses: {
      /** @description Successful Response */
      201: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['MovementOut']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  list_albums_api_v1_media_albums_get: {
    parameters: {
      query?: {
        visibility?: ('privado' | 'publico') | null
      }
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['AlbumSummaryOut'][]
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  create_album_api_v1_media_albums_post: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['AlbumIn']
      }
    }
    responses: {
      /** @description Successful Response */
      201: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['AlbumOut']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  get_album_api_v1_media_albums__album_id__get: {
    parameters: {
      query?: never
      header?: never
      path: {
        album_id: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['AlbumOut']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  delete_album_api_v1_media_albums__album_id__delete: {
    parameters: {
      query?: never
      header?: never
      path: {
        album_id: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['MessageResponse']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  update_album_api_v1_media_albums__album_id__patch: {
    parameters: {
      query?: never
      header?: never
      path: {
        album_id: string
      }
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['AlbumUpdate']
      }
    }
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['AlbumOut']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  add_asset_api_v1_media_albums__album_id__assets_post: {
    parameters: {
      query?: never
      header?: never
      path: {
        album_id: string
      }
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['AssetIn']
      }
    }
    responses: {
      /** @description Successful Response */
      201: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['AssetOut']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  publish_api_v1_media_albums__album_id__publish_post: {
    parameters: {
      query?: never
      header?: never
      path: {
        album_id: string
      }
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['AlbumPublish']
      }
    }
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['AlbumOut']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  unpublish_api_v1_media_albums__album_id__unpublish_post: {
    parameters: {
      query?: never
      header?: never
      path: {
        album_id: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['AlbumOut']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  upload_signature_api_v1_media_albums__album_id__upload_signature_post: {
    parameters: {
      query?: never
      header?: never
      path: {
        album_id: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['UploadSignatureOut']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  remove_asset_api_v1_media_assets__asset_id__delete: {
    parameters: {
      query?: never
      header?: never
      path: {
        asset_id: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['MessageResponse']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  set_tags_api_v1_media_assets__asset_id__tags_put: {
    parameters: {
      query?: never
      header?: never
      path: {
        asset_id: string
      }
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['TagsIn']
      }
    }
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['AssetOut']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  list_patients_api_v1_patients_get: {
    parameters: {
      query?: {
        search?: string | null
        status?: string | null
        includeInactive?: boolean
        /** @description Pestaña del listado; si se indica, reemplaza a includeInactive */
        group?: ('all' | 'active' | 'consent_pending' | 'inactive') | null
        /** @description Solo quienes vinieron a esa actividad en los últimos 6 meses */
        activity?:
          | (
              | 'fisioterapia'
              | 'arteterapia'
              | 'fonoaudiologia'
              | 'psicologia'
              | 'teatro'
              | 'familias'
              | 'comunitario'
            )
          | null
        order?: 'name' | '-name' | 'recent' | 'oldest'
        limit?: number
        offset?: number
      }
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['PatientPage']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  create_patient_api_v1_patients_post: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['PatientIn']
      }
    }
    responses: {
      /** @description Successful Response */
      201: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['PatientOut']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  patient_counts_api_v1_patients_summary_get: {
    parameters: {
      query?: {
        search?: string | null
        activity?:
          | (
              | 'fisioterapia'
              | 'arteterapia'
              | 'fonoaudiologia'
              | 'psicologia'
              | 'teatro'
              | 'familias'
              | 'comunitario'
            )
          | null
      }
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['PatientCounts']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  get_patient_api_v1_patients__patient_id__get: {
    parameters: {
      query?: never
      header?: never
      path: {
        patient_id: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['PatientOut']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  update_patient_api_v1_patients__patient_id__patch: {
    parameters: {
      query?: never
      header?: never
      path: {
        patient_id: string
      }
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['PatientUpdate']
      }
    }
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['PatientOut']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  patient_attendance_api_v1_patients__patient_id__attendance_get: {
    parameters: {
      query?: {
        limit?: number
        offset?: number
      }
      header?: never
      path: {
        patient_id: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['PatientAttendancePage']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  list_contacts_api_v1_patients__patient_id__contacts_get: {
    parameters: {
      query?: never
      header?: never
      path: {
        patient_id: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ContactOut'][]
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  add_contact_api_v1_patients__patient_id__contacts_post: {
    parameters: {
      query?: never
      header?: never
      path: {
        patient_id: string
      }
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['ContactIn']
      }
    }
    responses: {
      /** @description Successful Response */
      201: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ContactOut']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  remove_contact_api_v1_patients__patient_id__contacts__contact_id__delete: {
    parameters: {
      query?: never
      header?: never
      path: {
        patient_id: string
        contact_id: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['MessageResponse']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  update_contact_api_v1_patients__patient_id__contacts__contact_id__patch: {
    parameters: {
      query?: never
      header?: never
      path: {
        patient_id: string
        contact_id: string
      }
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['ContactUpdate']
      }
    }
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ContactOut']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  deactivate_patient_api_v1_patients__patient_id__deactivate_post: {
    parameters: {
      query?: never
      header?: never
      path: {
        patient_id: string
      }
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['PatientDeactivate']
      }
    }
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['PatientOut']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  list_documents_api_v1_patients__patient_id__documents_get: {
    parameters: {
      query?: never
      header?: never
      path: {
        patient_id: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['PatientDocumentOut'][]
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  upload_document_api_v1_patients__patient_id__documents_post: {
    parameters: {
      query?: never
      header?: never
      path: {
        patient_id: string
      }
      cookie?: never
    }
    requestBody: {
      content: {
        'multipart/form-data': components['schemas']['Body_upload_document_api_v1_patients__patient_id__documents_post']
      }
    }
    responses: {
      /** @description Successful Response */
      201: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['PatientDocumentOut']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  delete_document_api_v1_patients__patient_id__documents__document_id__delete: {
    parameters: {
      query?: never
      header?: never
      path: {
        patient_id: string
        document_id: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['MessageResponse']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  document_url_api_v1_patients__patient_id__documents__document_id__url_get: {
    parameters: {
      query?: never
      header?: never
      path: {
        patient_id: string
        document_id: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['SignedUrlOut']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  list_evaluations_api_v1_patients__patient_id__evaluations_get: {
    parameters: {
      query?: {
        area?: ('fisica' | 'fonoaudiologica' | 'psicologica') | null
      }
      header?: never
      path: {
        patient_id: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['EvaluationOut'][]
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  create_evaluation_api_v1_patients__patient_id__evaluations_post: {
    parameters: {
      query?: never
      header?: never
      path: {
        patient_id: string
      }
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['EvaluationIn']
      }
    }
    responses: {
      /** @description Successful Response */
      201: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['EvaluationOut']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  get_evaluation_api_v1_patients__patient_id__evaluations__evaluation_id__get: {
    parameters: {
      query?: never
      header?: never
      path: {
        patient_id: string
        evaluation_id: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['EvaluationOut']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  update_evaluation_api_v1_patients__patient_id__evaluations__evaluation_id__patch: {
    parameters: {
      query?: never
      header?: never
      path: {
        patient_id: string
        evaluation_id: string
      }
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['EvaluationUpdate']
      }
    }
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['EvaluationOut']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  remove_evaluation_api_v1_patients__patient_id__evaluations__evaluation_id__remove_post: {
    parameters: {
      query?: never
      header?: never
      path: {
        patient_id: string
        evaluation_id: string
      }
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['EvaluationRemove']
      }
    }
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['MessageResponse']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  reactivate_patient_api_v1_patients__patient_id__reactivate_post: {
    parameters: {
      query?: never
      header?: never
      path: {
        patient_id: string
      }
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['PatientReactivate']
      }
    }
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['PatientOut']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  public_content_api_v1_public_content_get: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['PublicSectionOut'][]
        }
      }
    }
  }
  public_section_api_v1_public_content__key__get: {
    parameters: {
      query?: never
      header?: never
      path: {
        key: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['PublicSectionOut']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  public_goal_api_v1_public_donations_goal_get: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['PublicGoalOut'] | null
        }
      }
    }
  }
  register_notice_api_v1_public_donations_notice_post: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['DonationNoticeIn']
      }
    }
    responses: {
      /** @description Successful Response */
      201: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['DonationTrackingOut']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  track_notice_api_v1_public_donations_notice__donation_id__get: {
    parameters: {
      query?: never
      header?: never
      path: {
        donation_id: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['DonationTrackingOut']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  create_public_api_v1_public_inquiries_post: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['PublicInquiryIn']
      }
    }
    responses: {
      /** @description Successful Response */
      202: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['MessageResponse']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  public_albums_api_v1_public_media_albums_get: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['PublicAlbumSummaryOut'][]
        }
      }
    }
  }
  public_album_api_v1_public_media_albums__album_id__get: {
    parameters: {
      query?: never
      header?: never
      path: {
        album_id: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['PublicAlbumOut']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  public_schedules_api_v1_public_schedules_get: {
    parameters: {
      query?: {
        from?: string | null
        to?: string | null
      }
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['PublicScheduleOut'][]
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  get_matrix_api_v1_roles_get: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['RoleMatrixOut']
        }
      }
    }
  }
  update_permissions_api_v1_roles__role_key__permissions_put: {
    parameters: {
      query?: never
      header?: never
      path: {
        role_key: string
      }
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['RolePermissionsUpdate']
      }
    }
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['RoleOut']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  list_schedules_api_v1_schedules_get: {
    parameters: {
      query?: {
        from?: string | null
        to?: string | null
        status?: ('borrador' | 'publicada' | 'cancelada') | null
        limit?: number
        offset?: number
      }
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['SchedulePage']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  create_schedule_api_v1_schedules_post: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['ScheduleIn']
      }
    }
    responses: {
      /** @description Successful Response */
      201: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ScheduleOut']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  get_schedule_api_v1_schedules__schedule_id__get: {
    parameters: {
      query?: never
      header?: never
      path: {
        schedule_id: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ScheduleOut']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  delete_api_v1_schedules__schedule_id__delete: {
    parameters: {
      query?: never
      header?: never
      path: {
        schedule_id: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['MessageResponse']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  update_schedule_api_v1_schedules__schedule_id__patch: {
    parameters: {
      query?: never
      header?: never
      path: {
        schedule_id: string
      }
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['ScheduleUpdate']
      }
    }
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ScheduleOut']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  get_sheet_api_v1_schedules__schedule_id__attendance_get: {
    parameters: {
      query?: {
        search?: string | null
      }
      header?: never
      path: {
        schedule_id: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['AttendanceSheetOut']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  close_api_v1_schedules__schedule_id__attendance_close_post: {
    parameters: {
      query?: never
      header?: never
      path: {
        schedule_id: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['AttendanceSheetOut']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  mark_all_present_api_v1_schedules__schedule_id__attendance_mark_all_present_post: {
    parameters: {
      query?: never
      header?: never
      path: {
        schedule_id: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['AttendanceSheetOut']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  add_newcomer_api_v1_schedules__schedule_id__attendance_newcomers_post: {
    parameters: {
      query?: never
      header?: never
      path: {
        schedule_id: string
      }
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['NewcomerIn']
      }
    }
    responses: {
      /** @description Successful Response */
      201: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['NewcomerOut']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  reopen_api_v1_schedules__schedule_id__attendance_reopen_post: {
    parameters: {
      query?: never
      header?: never
      path: {
        schedule_id: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['AttendanceSheetOut']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  mark_api_v1_schedules__schedule_id__attendance__patient_id__put: {
    parameters: {
      query?: never
      header?: never
      path: {
        schedule_id: string
        patient_id: string
      }
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['AttendanceMark']
      }
    }
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['AttendanceEntryOut']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  cancel_api_v1_schedules__schedule_id__cancel_post: {
    parameters: {
      query?: never
      header?: never
      path: {
        schedule_id: string
      }
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['ScheduleCancel']
      }
    }
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ScheduleOut']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  publish_api_v1_schedules__schedule_id__publish_post: {
    parameters: {
      query?: never
      header?: never
      path: {
        schedule_id: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ScheduleOut']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  unpublish_api_v1_schedules__schedule_id__unpublish_post: {
    parameters: {
      query?: never
      header?: never
      path: {
        schedule_id: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['ScheduleOut']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  list_users_api_v1_users_get: {
    parameters: {
      query?: {
        search?: string | null
        /** @description Clave del rol, o «pendiente» para las cuentas que esperan aprobación */
        role?: string | null
        limit?: number
        offset?: number
      }
      header?: never
      path?: never
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['UserPage']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  create_user_api_v1_users_post: {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['UserCreate']
      }
    }
    responses: {
      /** @description Successful Response */
      201: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['UserCreated']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  update_user_api_v1_users__user_id__patch: {
    parameters: {
      query?: never
      header?: never
      path: {
        user_id: string
      }
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['UserUpdate']
      }
    }
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['UserOut']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  approve_user_api_v1_users__user_id__approve_post: {
    parameters: {
      query?: never
      header?: never
      path: {
        user_id: string
      }
      cookie?: never
    }
    requestBody: {
      content: {
        'application/json': components['schemas']['UserApprove']
      }
    }
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['UserOut']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
  reset_password_api_v1_users__user_id__reset_password_post: {
    parameters: {
      query?: never
      header?: never
      path: {
        user_id: string
      }
      cookie?: never
    }
    requestBody?: never
    responses: {
      /** @description Successful Response */
      200: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['PasswordResetOut']
        }
      }
      /** @description Validation Error */
      422: {
        headers: {
          [name: string]: unknown
        }
        content: {
          'application/json': components['schemas']['HTTPValidationError']
        }
      }
    }
  }
}
