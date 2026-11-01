import { describe, expect, it } from 'vitest'

import contract from '../../../../docs/api/openapi.json'

import { HttpClient } from '../client'
import { createEndpoints } from '../endpoints'
import { call, fakeFetch } from './fakeFetch'

const BASE = 'https://api.aspar.test/api/v1'

function setup() {
  const fetchMock = fakeFetch()
  const api = createEndpoints(
    new HttpClient({ baseUrl: BASE, fetch: fetchMock }),
  )
  return { api, fetchMock }
}

/** Operaciones del contrato («GET /patients/{patient_id}») con su patrón de ruta. */
function contractOperations() {
  return Object.entries(contract.paths).flatMap(([path, methods]) => {
    const route = path.replace(/^\/api\/v1/, '')
    const pattern = new RegExp(`^${route.replace(/\{[^}]+\}/g, '[^/]+')}$`)
    const params = (route.match(/\{/g) ?? []).length
    return Object.keys(methods).map((method) => ({
      operation: `${method.toUpperCase()} ${route}`,
      method: method.toUpperCase(),
      pattern,
      params,
    }))
  })
}

type Request = [send: () => Promise<unknown>, method: string, path: string]

/** Una llamada por método de src/api, con la ruta y el verbo que debe usar. */
function requestsFor(api: ReturnType<typeof createEndpoints>): Request[] {
  return [
    [
      () => api.auth.login({ email: 'admin@aspar.org', password: 'x' }),
      'POST',
      '/auth/login',
    ],
    [
      () => api.auth.loginWithGoogle({ credential: 'id-token' }),
      'POST',
      '/auth/google',
    ],
    [
      () =>
        api.auth.changePassword({
          currentPassword: 'Temporal-1234-Clave',
          newPassword: 'NuevaClave2026',
        }),
      'POST',
      '/auth/change-password',
    ],
    [() => api.auth.me(), 'GET', '/auth/me'],
    [() => api.auth.refresh(), 'POST', '/auth/refresh'],
    [() => api.auth.logout(), 'POST', '/auth/logout'],
    [
      () =>
        api.auth.register({
          name: 'Rosa',
          email: 'r@gmail.com',
          password: 'x',
          turnstileToken: 't',
        }),
      'POST',
      '/auth/register',
    ],
    [() => api.auth.verifyEmail({ token: 't' }), 'POST', '/auth/verify-email'],
    [
      () =>
        api.auth.resendVerification({
          email: 'r@gmail.com',
          turnstileToken: 't',
        }),
      'POST',
      '/auth/resend-verification',
    ],
    [
      () =>
        api.auth.forgotPassword({
          email: 'r@gmail.com',
          turnstileToken: 't',
        }),
      'POST',
      '/auth/forgot-password',
    ],
    [
      () => api.auth.resetPassword({ token: 't', password: 'x' }),
      'POST',
      '/auth/reset-password',
    ],
    [
      () => api.patients.list({ search: 'rojas', limit: 20 }),
      'GET',
      '/patients?search=rojas&limit=20',
    ],
    [
      () =>
        api.patients.create({
          name: 'Juana Quispe',
          ci: '5566778',
          phone: '76543210',
          contacts: [
            { name: 'Pedro Quispe', relation: 'Hijo', phone: '70011223' },
          ],
        }),
      'POST',
      '/patients',
    ],
    [() => api.patients.get('p 1'), 'GET', '/patients/p%201'],
    [
      () => api.patients.list({ group: 'consent_pending', order: 'name' }),
      'GET',
      '/patients?group=consent_pending&order=name',
    ],
    [
      () => api.patients.summary({ activity: 'teatro' }),
      'GET',
      '/patients/summary?activity=teatro',
    ],
    [
      () => api.patients.attendance('p 1', { limit: 5 }),
      'GET',
      '/patients/p%201/attendance?limit=5',
    ],
    [() => api.system.health(), 'GET', '/health'],
    [() => api.system.healthDb(), 'GET', '/health/db'],
    [
      () => api.patients.update('p1', { phone: '70000000' }),
      'PATCH',
      '/patients/p1',
    ],
    [
      () => api.patients.deactivate('p1', { reason: 'Se mudó' }),
      'POST',
      '/patients/p1/deactivate',
    ],
    [
      () => api.patients.reactivate('p1', { reason: 'Volvió' }),
      'POST',
      '/patients/p1/reactivate',
    ],
    [() => api.documents.list('p1'), 'GET', '/patients/p1/documents'],
    [() => api.contacts.list('p1'), 'GET', '/patients/p1/contacts'],
    [
      () =>
        api.contacts.add('p1', {
          name: 'Rosa',
          relation: 'Hija',
          phone: '76559012',
        }),
      'POST',
      '/patients/p1/contacts',
    ],
    [
      () => api.contacts.update('p1', 'c1', { isPrimary: true }),
      'PATCH',
      '/patients/p1/contacts/c1',
    ],
    [
      () => api.contacts.remove('p1', 'c1'),
      'DELETE',
      '/patients/p1/contacts/c1',
    ],
    [
      () => api.evaluations.list('p1', 'fisica'),
      'GET',
      '/patients/p1/evaluations?area=fisica',
    ],
    [
      () => api.evaluations.get('p1', 'e1'),
      'GET',
      '/patients/p1/evaluations/e1',
    ],
    [
      () =>
        api.evaluations.create('p1', {
          area: 'fisica',
          evaluatedOn: '2026-10-14',
          notes: 'Mejor equilibrio.',
        }),
      'POST',
      '/patients/p1/evaluations',
    ],
    [
      () => api.evaluations.update('p1', 'e1', { notes: 'Corregido.' }),
      'PATCH',
      '/patients/p1/evaluations/e1',
    ],
    [
      () => api.documents.signedUrl('p1', 'd1'),
      'GET',
      '/patients/p1/documents/d1/url',
    ],
    [
      () => api.documents.remove('p1', 'd1'),
      'DELETE',
      '/patients/p1/documents/d1',
    ],
    [() => api.users.list({ search: 'ana' }), 'GET', '/users?search=ana'],
    [
      () =>
        api.users.create({
          name: 'Ana',
          email: 'ana@aspar.org',
          role: 'volunteer',
        }),
      'POST',
      '/users',
    ],
    [() => api.users.update('u1', { active: false }), 'PATCH', '/users/u1'],
    [() => api.users.resetPassword('u1'), 'POST', '/users/u1/reset-password'],
    [
      () => api.users.list({ role: 'pendiente' }),
      'GET',
      '/users?role=pendiente',
    ],
    [
      () => api.users.approve('u1', { role: 'reception' }),
      'POST',
      '/users/u1/approve',
    ],
    [() => api.roles.matrix(), 'GET', '/roles'],
    [
      () => api.schedules.list({ status: 'borrador' }),
      'GET',
      '/schedules?status=borrador',
    ],
    [() => api.schedules.get('s1'), 'GET', '/schedules/s1'],
    [
      () =>
        api.schedules.create({
          title: 'Movimiento en compañía',
          category: 'fisioterapia',
          date: '2026-11-07',
          startTime: '10:00',
          endTime: '11:30',
          location: 'Sede ASPAR',
        }),
      'POST',
      '/schedules',
    ],
    [() => api.schedules.update('s1', { spots: 30 }), 'PATCH', '/schedules/s1'],
    [() => api.schedules.publish('s1'), 'POST', '/schedules/s1/publish'],
    [() => api.schedules.unpublish('s1'), 'POST', '/schedules/s1/unpublish'],
    [
      () => api.schedules.cancel('s1', { note: 'Se reprograma' }),
      'POST',
      '/schedules/s1/cancel',
    ],
    [() => api.schedules.remove('s1'), 'DELETE', '/schedules/s1'],
    [
      () => api.attendance.sheet('s1', 'alba'),
      'GET',
      '/schedules/s1/attendance?search=alba',
    ],
    [
      () =>
        api.attendance.mark('s1', 'p1', {
          status: 'vino',
          note: 'Con su hija',
        }),
      'PUT',
      '/schedules/s1/attendance/p1',
    ],
    [
      () => api.attendance.markAllPresent('s1'),
      'POST',
      '/schedules/s1/attendance/mark-all-present',
    ],
    [
      () => api.attendance.close('s1'),
      'POST',
      '/schedules/s1/attendance/close',
    ],
    [
      () => api.attendance.reopen('s1'),
      'POST',
      '/schedules/s1/attendance/reopen',
    ],
    [
      () =>
        api.attendance.addNewcomer('s1', {
          name: 'Elena Quisbert',
          phone: '71234567',
        }),
      'POST',
      '/schedules/s1/attendance/newcomers',
    ],
    [
      () => api.attendance.monthly('2026-10'),
      'GET',
      '/attendance/monthly?month=2026-10',
    ],
    [
      () => api.inventory.list({ origin: 'alcaldia' }),
      'GET',
      '/inventory?origin=alcaldia',
    ],
    [() => api.inventory.summary(), 'GET', '/inventory/summary'],
    [() => api.inventory.get('i1'), 'GET', '/inventory/i1'],
    [
      () =>
        api.inventory.create({
          name: 'Colchonetas',
          category: 'fisioterapia',
          quantity: 12,
          condition: 'bueno',
          origin: 'alcaldia',
        }),
      'POST',
      '/inventory',
    ],
    [
      () => api.inventory.update('i1', { quantity: 10, reason: 'Conteo' }),
      'PATCH',
      '/inventory/i1',
    ],
    [() => api.inventory.movements('i1'), 'GET', '/inventory/i1/movements'],
    [
      () =>
        api.inventory.addMovement('i1', {
          movementType: 'prestamo',
          quantity: 2,
          counterpart: 'Familia Apaza',
        }),
      'POST',
      '/inventory/i1/movements',
    ],
    [
      () => api.inventory.deactivate('i1', { reason: 'Se rompió' }),
      'POST',
      '/inventory/i1/deactivate',
    ],
    [() => api.inventory.export('csv'), 'GET', '/inventory/export?format=csv'],
    [
      () => api.donations.list({ status: 'pendiente' }),
      'GET',
      '/donations?status=pendiente',
    ],
    [
      () => api.donations.summary('2026-10'),
      'GET',
      '/donations/summary?month=2026-10',
    ],
    [
      () => api.donations.downloadSummary('xlsx', '2026-10'),
      'GET',
      '/donations/summary?month=2026-10&format=xlsx',
    ],
    [() => api.donations.get('d1'), 'GET', '/donations/d1'],
    [
      () =>
        api.donations.registerReceived({
          channel: 'efectivo',
          amountBs: 300,
        }),
      'POST',
      '/donations',
    ],
    [
      () =>
        api.donations.confirm('d1', {
          bankReference: '48213907',
          creditedOn: '2026-10-28',
        }),
      'POST',
      '/donations/d1/confirm',
    ],
    [
      () => api.donations.cancel('d1', { reason: 'No está en el extracto' }),
      'POST',
      '/donations/d1/cancel',
    ],
    [() => api.donations.goal(), 'GET', '/donations/goal'],
    [
      () => api.donations.saveGoal({ title: 'Meta', targetBs: 60000 }),
      'PUT',
      '/donations/goal',
    ],
    [() => api.public.donationGoal(), 'GET', '/public/donations/goal'],
    [
      () => api.public.notifyDonation({ amountBs: 100, turnstileToken: 't' }),
      'POST',
      '/public/donations/notice',
    ],
    [
      () => api.public.trackDonation('d1'),
      'GET',
      '/public/donations/notice/d1',
    ],
    [
      () => api.media.albums('publico'),
      'GET',
      '/media/albums?visibility=publico',
    ],
    [() => api.media.album('a1'), 'GET', '/media/albums/a1'],
    [
      () => api.media.createAlbum({ title: 'Crear con las manos' }),
      'POST',
      '/media/albums',
    ],
    [
      () => api.media.updateAlbum('a1', { description: 'Taller' }),
      'PATCH',
      '/media/albums/a1',
    ],
    [() => api.media.deleteAlbum('a1'), 'DELETE', '/media/albums/a1'],
    [
      () => api.media.uploadSignature('a1'),
      'POST',
      '/media/albums/a1/upload-signature',
    ],
    [
      () =>
        api.media.addAsset('a1', {
          publicId: 'aspar/albums/a1/foto',
          url: 'https://res.cloudinary.com/aspar/image/upload/foto.jpg',
          kind: 'imagen',
          sizeBytes: 1000,
        }),
      'POST',
      '/media/albums/a1/assets',
    ],
    [() => api.media.removeAsset('f1'), 'DELETE', '/media/assets/f1'],
    [() => api.media.setTags('f1', ['p1']), 'PUT', '/media/assets/f1/tags'],
    [
      () => api.media.publish('a1', { permissionsReviewed: true }),
      'POST',
      '/media/albums/a1/publish',
    ],
    [() => api.media.unpublish('a1'), 'POST', '/media/albums/a1/unpublish'],
    [() => api.content.sections(), 'GET', '/content/sections'],
    [
      () => api.content.section('historia'),
      'GET',
      '/content/sections/historia',
    ],
    [
      () => api.content.saveDraft('historia', { content: { texto: 'x' } }),
      'PUT',
      '/content/sections/historia',
    ],
    [
      () => api.content.publish('historia'),
      'POST',
      '/content/sections/historia/publish',
    ],
    [
      () =>
        api.content.saveSocialLinks({
          facebook: 'https://facebook.com/aspar',
        }),
      'PUT',
      '/content/social-links',
    ],
    [() => api.public.albums(), 'GET', '/public/media/albums'],
    [() => api.public.album('a1'), 'GET', '/public/media/albums/a1'],
    [() => api.public.content(), 'GET', '/public/content'],
    [() => api.public.section('historia'), 'GET', '/public/content/historia'],
    [
      () => api.inquiries.list({ status: 'recibida' }),
      'GET',
      '/inquiries?status=recibida',
    ],
    [() => api.inquiries.summary(), 'GET', '/inquiries/summary'],
    [() => api.inquiries.get('q1'), 'GET', '/inquiries/q1'],
    [
      () => api.inquiries.update('q1', { status: 'por_contactar' }),
      'PATCH',
      '/inquiries/q1',
    ],
    [
      () =>
        api.inquiries.addNote('q1', {
          note: 'Vendrá el sábado',
          markContacted: true,
        }),
      'POST',
      '/inquiries/q1/notes',
    ],
    [
      () => api.inquiries.patientDraft('q1'),
      'GET',
      '/inquiries/q1/patient-draft',
    ],
    [
      () => api.inquiries.convertToPatient('q1', { ci: '8899001' }),
      'POST',
      '/inquiries/q1/convert-to-patient',
    ],
    [() => api.dashboard.summary(), 'GET', '/dashboard/summary'],
    [
      () =>
        api.public.sendInquiry({
          kind: 'orientacion',
          name: 'Rosa Mamani',
          phone: '71548214',
          contactConsent: true,
          turnstileToken: 't',
        }),
      'POST',
      '/public/inquiries',
    ],
    [
      () => api.public.schedules({ from: '2026-11-01' }),
      'GET',
      '/public/schedules?from=2026-11-01',
    ],
    [
      () =>
        api.roles.updatePermissions('volunteer', {
          permissions: ['attendance:write', 'patients:read'],
          confirmSensitive: false,
        }),
      'PUT',
      '/roles/volunteer/permissions',
    ],
    [
      () => api.audit.list({ severity: 'CRITICAL', from: '2026-10-01' }),
      'GET',
      '/audit?severity=CRITICAL&from=2026-10-01',
    ],
  ]
}

describe('Endpoints', () => {
  it('cada método llama a la ruta y el verbo del contrato', async () => {
    const { api, fetchMock } = setup()
    const requests = requestsFor(api)

    for (const [index, [send, method, path]] of requests.entries()) {
      await send()
      expect(call(fetchMock, index).init.method, path).toBe(method)
      expect(call(fetchMock, index).url).toBe(`${BASE}${path}`)
    }
  })

  it('descarga el resumen mensual como archivo', async () => {
    const fetchMock = fakeFetch({ body: 'Fecha;Actividad' })
    const api = createEndpoints(
      new HttpClient({ baseUrl: BASE, fetch: fetchMock }),
    )

    const file = await api.attendance.downloadMonthly('csv', '2026-10')

    expect(call(fetchMock).url).toBe(
      `${BASE}/attendance/monthly?month=2026-10&format=csv`,
    )
    // En las pruebas el Blob de fetch (Node) y el global (jsdom) son de clases distintas
    expect(file.size).toBe(15)
    expect(await file.text()).toBe('Fecha;Actividad')
  })

  it('sube documentos como multipart con su tipo', async () => {
    const { api, fetchMock } = setup()
    const file = new Blob(['%PDF-1.7'], { type: 'application/pdf' })

    await api.documents.upload(
      'p1',
      'Consentimiento',
      file,
      'consentimiento.pdf',
    )

    const body = call(fetchMock).init.body as FormData
    expect(body.get('documentType')).toBe('Consentimiento')
    expect((body.get('file') as File).name).toBe('consentimiento.pdf')
  })

  it('src/api cubre el 100 % de las operaciones del contrato OpenAPI', async () => {
    const { api, fetchMock } = setup()
    for (const [send] of requestsFor(api)) await send()
    await api.documents.upload('p1', 'Otro', new Blob(['%PDF-1.7']), 'a.pdf')
    await api.attendance.downloadMonthly('xlsx')

    const operations = contractOperations()
    const covered = new Set<string>()
    const unknown: string[] = []
    for (const [url, init] of fetchMock.mock.calls) {
      const method = (init as RequestInit).method
      const path = new URL(String(url)).pathname.replace(/^\/api\/v1/, '')
      // La ruta más específica gana: /inventory/summary antes que /inventory/{item_id}
      const match = operations
        .filter((op) => op.method === method && op.pattern.test(path))
        .sort((a, b) => a.params - b.params)[0]
      if (match) covered.add(match.operation)
      else unknown.push(`${method} ${path}`)
    }

    expect(unknown, 'métodos que llaman a rutas que no existen').toEqual([])
    expect(
      operations.map((op) => op.operation).filter((op) => !covered.has(op)),
      'operaciones del contrato sin método en src/api',
    ).toEqual([])
  })
})
