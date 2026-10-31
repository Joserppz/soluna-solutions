/**
 * ARCHIVO GENERADO: no lo edites a mano.
 * Fuente: docs/api/openapi.json. Regenerar con: npm run api:types
 */

export interface paths {
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
  '/api/v1/patients/{patient_id}/reactivate': {
    parameters: {
      query?: never
      header?: never
      path?: never
      cookie?: never
    }
    get?: never
    put?: never
    /** Reactivate Patient */
    post: operations['reactivate_patient_api_v1_patients__patient_id__reactivate_post']
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
     * @description Equipo, con búsqueda por nombre o correo.
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
    /** AuditEventOut */
    AuditEventOut: {
      /** Action */
      action: string
      /** Actor */
      actor: string
      /** Actorrole */
      actorRole: string
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
    /** EmailRequest */
    EmailRequest: {
      /** Email */
      email: string
      /** Turnstiletoken */
      turnstileToken: string
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
    /** PasswordResetOut */
    PasswordResetOut: {
      /** Message */
      message: string
      /** Temporarypassword */
      temporaryPassword: string
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
     * PatientSummaryOut
     * @description Fila del listado: sin anamnesis (S5). La ficha clínica completa solo se obtiene con
     *     GET /patients/{id}, que queda en la bitácora.
     */
    PatientSummaryOut: {
      /** Accessstatus */
      accessStatus: string
      /** Active */
      active: boolean
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
    /** TokenRequest */
    TokenRequest: {
      /** Token */
      token: string
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
  list_audit_events_api_v1_audit_get: {
    parameters: {
      query?: {
        category?: string | null
        severity?: string | null
        actor?: string | null
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
  list_patients_api_v1_patients_get: {
    parameters: {
      query?: {
        search?: string | null
        status?: string | null
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
  reactivate_patient_api_v1_patients__patient_id__reactivate_post: {
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
  list_users_api_v1_users_get: {
    parameters: {
      query?: {
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
