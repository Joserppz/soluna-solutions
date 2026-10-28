import { createRouter, createWebHistory } from 'vue-router'
import LoginView from '../views/LoginView.vue'
import PatientsView from '../views/PatientsView.vue'
import RegisterPatientView from '../views/RegisterPatientView.vue'
import UsersView from '../views/UsersView.vue'
import AuditView from '../views/AuditView.vue'
import ScheduleView from '../views/ScheduleView.vue'
import AttendanceView from '../views/AttendanceView.vue'
import InventoryView from '../views/InventoryView.vue'
import { addAudit, getSession } from '../services/aspar'

const router = createRouter({
  history: createWebHistory(),
  // Enlaces de la cabecera a las secciones del portal (#cronograma, #galeria, #donar)
  scrollBehavior(to) {
    if (to.hash) return { el: to.hash, behavior: 'smooth' }
    return { top: 0 }
  },
  routes: [
    { path: '/', name: 'cronograma', component: ScheduleView },
    { path: '/login', name: 'login', component: LoginView },
    {
      path: '/pacientes',
      name: 'pacientes',
      component: PatientsView,
      meta: { requiresAuth: true },
    },
    {
      path: '/pacientes/nuevo',
      name: 'registrar-paciente',
      component: RegisterPatientView,
      meta: { requiresAuth: true },
    },
    {
      path: '/usuarios',
      name: 'usuarios',
      component: UsersView,
      meta: { requiresAuth: true, adminOnly: true },
    },
    {
      path: '/bitacora',
      name: 'bitacora',
      component: AuditView,
      meta: { requiresAuth: true, adminOnly: true },
    },
    {
      path: '/inventario',
      name: 'inventario',
      component: InventoryView,
      meta: { requiresAuth: true },
    },
    {
      path: '/asistencia',
      name: 'asistencia',
      component: AttendanceView,
      meta: { requiresAuth: true },
    },
  ],
})

router.beforeEach((to) => {
  const session = getSession()

  if (to.meta.requiresAuth && !session) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  if (to.meta.adminOnly && session?.role !== 'Administrador') {
    if (session) {
      addAudit(
        'Intento de acceso restringido bloqueado',
        `El rol ${session.role} (${session.email}) intentó acceder a ${to.fullPath}`,
        'SISTEMA',
        'WARNING',
      )
    }
    return { name: 'cronograma' }
  }

  if (to.name === 'login' && session) {
    return { name: 'cronograma' }
  }
})

export default router
