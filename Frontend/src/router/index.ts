import {
  createRouter,
  createWebHistory,
  type RouteRecordRaw,
  type RouterHistory,
} from 'vue-router'

import type { Permission } from '../api/types'
import { defaultApiContext, type ApiContext } from '../composables/useApi'
import { useToast } from '../composables/useToast'
import { checkAccess, snapshotOf, type RouteAccess } from './guards'
import { ADMIN_GROUP_TITLE, TEAM_SECTIONS } from './sections'

declare module 'vue-router' {
  interface RouteMeta {
    access?: RouteAccess
    /** Basta con uno de estos permisos. */
    permissions?: Permission[]
    title?: string
    /** Migas de pan después de «Espacio del equipo». */
    breadcrumb?: string[]
    description?: string
    /** Sección del menú que queda marcada (páginas internas, como una ficha). */
    section?: string
  }
}

/** La vista de cada sección del menú (todas conectadas a la API). */
export const SECTION_VIEWS: Record<string, RouteRecordRaw['component']> = {
  afiliados: () => import('../views/team/patients/PatientsListView.vue'),
  'equipo-permisos': () =>
    import('../views/team/admin/TeamPermissionsView.vue'),
  actividades: () => import('../views/team/ops/ActivitiesView.vue'),
  asistencia: () => import('../views/team/ops/AttendanceView.vue'),
  inventario: () => import('../views/team/ops/InventoryView.vue'),
  galeria: () => import('../views/team/media/GalleryView.vue'),
  contenido: () => import('../views/team/content/ContentView.vue'),
  donaciones: () => import('../views/team/donations/DonationsView.vue'),
  solicitudes: () => import('../views/team/inquiries/InquiriesView.vue'),
  'registro-actividad': () => import('../views/team/admin/ActivityLogView.vue'),
}

export const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: () => import('../layouts/PublicLayout.vue'),
    children: [
      {
        path: '',
        name: 'inicio',
        component: () => import('../views/public/HomeView.vue'),
        meta: { access: 'public', title: 'Inicio' },
      },
      {
        path: 'apoyar',
        name: 'apoyar',
        component: () => import('../views/public/SupportView.vue'),
        meta: { access: 'public', title: 'Apoya a ASPAR' },
      },
    ],
  },
  {
    path: '/ingresar',
    name: 'ingresar',
    component: () => import('../views/auth/LoginView.vue'),
    meta: { access: 'guest', title: 'Acceso del equipo' },
  },
  { path: '/login', redirect: { name: 'ingresar' } },
  {
    path: '/crear-cuenta',
    name: 'crear-cuenta',
    component: () => import('../views/auth/RegisterView.vue'),
    meta: { access: 'guest', title: 'Crea tu cuenta' },
  },
  {
    // Enlace del correo de confirmación (y pedido de un enlace nuevo)
    path: '/verificar-correo',
    name: 'verificar-correo',
    component: () => import('../views/auth/VerifyEmailView.vue'),
    meta: { access: 'public', title: 'Confirma tu correo' },
  },
  {
    path: '/recuperar-contrasena',
    name: 'recuperar-contrasena',
    component: () => import('../views/auth/ForgotPasswordView.vue'),
    meta: { access: 'guest', title: 'Recuperar contraseña' },
  },
  {
    // Enlace del correo de recuperación
    path: '/restablecer-contrasena',
    name: 'restablecer-contrasena',
    component: () => import('../views/auth/ResetPasswordView.vue'),
    meta: { access: 'public', title: 'Nueva contraseña' },
  },
  {
    path: '/cambiar-contrasena',
    name: 'cambiar-contrasena',
    component: () => import('../views/auth/ChangePasswordView.vue'),
    meta: { access: 'account', title: 'Crea tu contraseña' },
  },
  {
    path: '/cuenta-pendiente',
    name: 'cuenta-pendiente',
    component: () => import('../views/auth/PendingApprovalView.vue'),
    meta: { access: 'account', title: 'Cuenta en espera' },
  },
  {
    path: '/equipo',
    component: () => import('../layouts/TeamLayout.vue'),
    meta: { access: 'team' },
    children: [
      {
        path: '',
        name: 'resumen',
        component: () => import('../views/team/SummaryView.vue'),
        meta: { access: 'team', title: 'Resumen', breadcrumb: ['Resumen'] },
      },
      ...TEAM_SECTIONS.map((section): RouteRecordRaw => ({
        path: section.path,
        name: section.name,
        component: SECTION_VIEWS[section.name]!,
        meta: {
          access: 'team',
          permissions: section.permissions,
          title: section.title,
          description: section.description,
          breadcrumb: section.group
            ? [ADMIN_GROUP_TITLE, section.title]
            : [section.title],
        },
      })),
      {
        path: 'afiliados/:id',
        name: 'afiliado',
        component: () => import('../views/team/patients/PatientRecordView.vue'),
        meta: {
          access: 'team',
          permissions: ['patients:read'],
          title: 'Ficha del afiliado',
          description: 'Datos, familiares, historia clínica y asistencia.',
          breadcrumb: ['Afiliados', 'Ficha'],
          section: 'afiliados',
        },
      },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'no-encontrada',
    component: () => import('../views/NotFoundView.vue'),
    meta: { access: 'public', title: 'Página no encontrada' },
  },
]

export function createAppRouter(
  context: ApiContext = defaultApiContext,
  history: RouterHistory = createWebHistory(),
) {
  const router = createRouter({
    history,
    routes,
    scrollBehavior(to, from, saved) {
      if (saved) return saved
      if (to.hash) return { el: to.hash, behavior: 'smooth' }
      // Solo cambió la pestaña, la búsqueda o la página de la misma pantalla: la vista
      // decide (por ejemplo, volver justo debajo de su encabezado fijo)
      if (to.path === from.path) return false
      return { top: 0 }
    },
  })
  const toast = useToast()
  const { session } = context

  router.beforeEach(async (to) => {
    // Al cargar la página se pregunta a la API si la cookie de sesión sigue vigente
    let offline = false
    if (session.state.status === 'unknown') {
      try {
        await session.restore()
      } catch {
        offline = true
      }
    }

    const decision = checkAccess(to, snapshotOf(session))
    if (decision.allow) return true
    if (offline && to.meta.access !== 'guest')
      return { name: 'ingresar', query: { motivo: 'sin-conexion' } }
    if (decision.notice) toast.info(decision.notice)
    return decision.redirect
  })

  router.afterEach((to) => {
    document.title = to.meta.title ? `${to.meta.title} · ASPAR` : 'ASPAR'
  })

  return router
}
