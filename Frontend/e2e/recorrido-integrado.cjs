/**
 * SCRUM-58 / SCRUM-88: recorrido integrado login + pacientes contra la API real.
 *
 * Requisitos: API en http://localhost:8000 (PostgreSQL migrado) y Frontend en
 * http://localhost:5173. Uso:
 *   npm i --no-save playwright && npx playwright install chromium
 *   node e2e/recorrido-integrado.cjs ../docs/evidencias/recorrido_integrado
 */
const { chromium } = require('playwright')

const FRONT = 'http://localhost:5173'
const API = 'http://localhost:8000/api/v1'
const outDir = process.argv[2] || '.'
const results = []

function check(step, ok, detail) {
  results.push({ step, ok, detail })
  console.log(`${ok ? 'OK  ' : 'FALLA'} ${step} — ${detail}`)
}

async function main() {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1280, height: 860 } })
  const calls = []
  page.on('response', (r) => {
    if (r.url().startsWith(API)) {
      calls.push(
        `${r.request().method()} ${r.url().replace(API, '')} → ${r.status()}`,
      )
    }
  })
  const session = () =>
    page.evaluate(() =>
      JSON.parse(localStorage.getItem('aspar_session') || 'null'),
    )
  const api = (path, token, init = {}) =>
    page.evaluate(
      async ({ url, token, init }) => {
        const res = await fetch(url, {
          ...init,
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        })
        return { status: res.status, body: await res.json().catch(() => null) }
      },
      { url: API + path, token, init },
    )

  async function login(email, password) {
    await page.goto(`${FRONT}/login`)
    await page.evaluate(() => localStorage.clear())
    await page.goto(`${FRONT}/login`)
    await page.fill('#email', email)
    await page.fill('#password', password)
    await page.click('button[type=submit]')
    await page.waitForTimeout(1500)
    return session()
  }

  // 1. Login del Administrador contra la API
  let s = await login('admin@aspar.org', 'Admin2026!')
  check(
    '1. Login Administrador',
    s?.source === 'api' && s.role === 'Administrador',
    `sesión source=${s?.source}, rol=${s?.role}`,
  )
  await page.screenshot({ path: `${outDir}/01_login_admin_api.png` })
  const adminToken = s.token

  // 2. Listado de pacientes igual al de la API
  await page.goto(`${FRONT}/pacientes`)
  await page.waitForTimeout(1500)
  const enPantalla = await page.locator('.patient-item-block').count()
  const desdeApi = (await api('/patients', adminToken)).body.length
  check(
    '2. Listado de pacientes',
    enPantalla === desdeApi,
    `pantalla=${enPantalla}, API=${desdeApi}`,
  )

  // 3. Alta de paciente desde el formulario, persistida en PostgreSQL
  await page.fill('#patient-name', 'Rosa Mamani Quispe')
  await page.fill('#patient-ci', '6849201')
  await page.fill('#patient-phone', '70112233')
  await page.fill('#patient-emergency', 'Pedro Mamani (hijo)')
  await page.click('form button[type=submit]')
  await page.waitForTimeout(2000)
  const persistido = (await api('/patients', adminToken)).body.find(
    (p) => p.ci === '6849201',
  )
  check(
    '3. Alta de paciente',
    Boolean(persistido),
    `persistido en la API: ${Boolean(persistido)}, estado=${persistido?.accessStatus}`,
  )
  await page.screenshot({ path: `${outDir}/02_alta_paciente.png` })

  // 4. La API rechaza la CI duplicada
  const dup = await api('/patients', adminToken, {
    method: 'POST',
    body: JSON.stringify({
      name: 'Otra Persona',
      ci: '6849201',
      phone: '70112234',
      emergencyContact: 'Contacto',
    }),
  })
  check(
    '4. CI duplicada',
    dup.status === 409,
    `HTTP ${dup.status}: ${dup.body?.detail}`,
  )

  // 5. El Administrador ve la anamnesis de un paciente con consentimiento
  await page.goto(`${FRONT}/pacientes`)
  await page.waitForTimeout(1200)
  const elena = page.locator('.patient-item-block', { hasText: 'Elena Rojas' })
  await elena.getByRole('button', { name: 'Ver anamnesis' }).click()
  const gridAdmin = await elena.locator('.anamnesis-grid').count()
  check(
    '5. Anamnesis visible para Administrador',
    gridAdmin === 1,
    `ficha clínica visible=${gridAdmin === 1}`,
  )
  await elena.screenshot({ path: `${outDir}/03_anamnesis_admin.png` })

  // 6. El Voluntario no recibe ni ve la anamnesis
  s = await login('voluntario@aspar.org', 'Voluntario2026!')
  const datosVol = (await api('/patients', s.token)).body.find(
    (p) => p.name === 'Elena Rojas',
  )
  await page.goto(`${FRONT}/pacientes`)
  await page.waitForTimeout(1200)
  const elenaVol = page.locator('.patient-item-block', {
    hasText: 'Elena Rojas',
  })
  await elenaVol.getByRole('button', { name: 'Ver anamnesis' }).click()
  const protegido = await elenaVol.locator('.protected-notice').count()
  check(
    '6. Anamnesis protegida para Voluntario',
    protegido === 1 && !datosVol.anamnesis.psychologicalEvaluation,
    `aviso RNF-06=${protegido === 1}, evaluación psicológica en la respuesta de la API="${datosVol.anamnesis.psychologicalEvaluation}"`,
  )
  await elenaVol.screenshot({
    path: `${outDir}/04_anamnesis_protegida_voluntario.png`,
  })

  // 7. Credenciales incorrectas
  s = await login('admin@aspar.org', 'ClaveIncorrecta9')
  const alerta = (await page.locator('[role=alert]').textContent())?.trim()
  check('7. Clave incorrecta', s === null, `sesión=${s}, mensaje="${alerta}"`)
  await page.screenshot({ path: `${outDir}/05_clave_incorrecta.png` })

  // 8. Cuenta bloqueada en el servidor (5 intentos fallidos)
  for (let i = 0; i < 5; i += 1) {
    await api('/auth/login', null, {
      method: 'POST',
      body: JSON.stringify({
        email: 'recepcion@aspar.org',
        password: 'Mala12345',
      }),
    })
  }
  const bloqueo = await api('/auth/login', null, {
    method: 'POST',
    body: JSON.stringify({
      email: 'recepcion@aspar.org',
      password: 'Recep2026!',
    }),
  })
  s = await login('recepcion@aspar.org', 'Recep2026!')
  check(
    '8. Cuenta bloqueada por el servidor',
    s === null,
    `API responde ${bloqueo.status}; el frontend ${s ? `abrió una sesión ${s.source}` : 'no abrió sesión'}`,
  )
  await page.screenshot({ path: `${outDir}/06_cuenta_bloqueada.png` })

  // 9. Cierre de sesión: el token deja de servir
  s = await login('admin@aspar.org', 'Admin2026!')
  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await page.waitForTimeout(1200)
  const despues = await api('/auth/verify', s.token)
  check(
    '9. Cierre de sesión',
    despues.status === 401,
    `GET /auth/verify con el token cerrado → ${despues.status}`,
  )

  // 10. El Administrador crea un usuario de Recepción y este entra con su contraseña temporal
  await login('admin@aspar.org', 'Admin2026!')
  await page.goto(`${FRONT}/usuarios`)
  await page.waitForTimeout(1200)
  await page.fill('#user-name', 'Lic. Sofía Morales')
  await page.fill('#user-email', 'sofia.morales@aspar.org')
  await page.selectOption('#user-role', 'Recepción')
  await page.click('form button[type=submit]')
  await page.waitForTimeout(1500)
  const temporal = (
    await page.locator('.credential-password').textContent()
  )?.trim()
  await page
    .locator('.credential-card')
    .screenshot({ path: `${outDir}/07_contrasena_temporal.png` })
  s = await login('sofia.morales@aspar.org', temporal || '')
  check(
    '10. Usuario nuevo con contraseña temporal',
    s?.source === 'api' && s.role === 'Recepción',
    `contraseña mostrada=${Boolean(temporal)}, sesión source=${s?.source}, rol=${s?.role}`,
  )

  // 11. Recepción registra la filiación sin campos clínicos
  await page.goto(`${FRONT}/pacientes`)
  await page.waitForTimeout(1200)
  const camposClinicos = await page
    .locator('#patient-phys, #patient-speech, #patient-psych')
    .count()
  check(
    '11. Formulario de Recepción sin campos clínicos',
    s !== null && camposClinicos === 0,
    `campos clínicos visibles=${camposClinicos}`,
  )
  await page
    .locator('form')
    .first()
    .screenshot({ path: `${outDir}/08_formulario_recepcion.png` })

  console.log('\nLlamadas del frontend a la API:')
  for (const call of calls) console.log(`  ${call}`)
  await browser.close()
  process.exitCode = results.every((r) => r.ok) ? 0 : 1
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
