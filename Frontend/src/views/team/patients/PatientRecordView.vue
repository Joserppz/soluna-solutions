<script setup lang="ts">
/**
 * Ficha del afiliado (diseño pág. 9): encabezado con estado y consentimiento, y las
 * pestañas Datos, Historia clínica, Evaluaciones, Asistencia y Documentos. Los datos
 * clínicos solo llegan si la API lo permite (RNF-06); la vista nunca los inventa.
 */
import { computed, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'

import { isApiError } from '../../../api/errors'
import type { EvaluationOut, PatientOut } from '../../../api/types'
import AttendanceTab from '../../../components/patients/record/AttendanceTab.vue'
import ClinicalHistoryTab from '../../../components/patients/record/ClinicalHistoryTab.vue'
import DataTab from '../../../components/patients/record/DataTab.vue'
import DocumentsTab from '../../../components/patients/record/DocumentsTab.vue'
import EvaluationsTab from '../../../components/patients/record/EvaluationsTab.vue'
import StatusDialog from '../../../components/patients/record/StatusDialog.vue'
import AppAlert from '../../../components/ui/AppAlert.vue'
import AppButton from '../../../components/ui/AppButton.vue'
import AppTabs, { type TabItem } from '../../../components/ui/AppTabs.vue'
import InitialsAvatar from '../../../components/ui/InitialsAvatar.vue'
import SkeletonBlock from '../../../components/ui/SkeletonBlock.vue'
import StatusBadge from '../../../components/ui/StatusBadge.vue'
import StickyHeader from '../../../components/ui/StickyHeader.vue'
import { useApi } from '../../../composables/useApi'
import { usePageCrumb } from '../../../composables/usePageCrumb'
import { patientsListLocation } from '../../../composables/usePatientsListLocation'
import { longDay, monthYear, todayIso } from '../../../utils/format'
import { ageOn, clinicalNotice, formatCi } from '../../../utils/patients'

type Section =
  'datos' | 'historia' | 'evaluaciones' | 'asistencia' | 'documentos'
const SECTIONS: Section[] = [
  'datos',
  'historia',
  'evaluaciones',
  'asistencia',
  'documentos',
]

const { api, session } = useApi()
const route = useRoute()
const router = useRouter()
const crumb = usePageCrumb()

const patientId = computed(() => String(route.params.id))
const patient = ref<PatientOut | null>(null)
const loading = ref(true)
const loadError = ref<{ status: number; message: string } | null>(null)
const evaluations = ref<EvaluationOut[] | null>(null)
const statusDialog = ref<'deactivate' | 'reactivate' | null>(null)
const dirty = ref(false)

const querySection = route.query.seccion as Section
const section = ref<Section>(
  SECTIONS.includes(querySection) ? querySection : 'datos',
)

const canDeactivate = computed(() => session.can('patients:deactivate'))
const notice = computed(() =>
  patient.value
    ? clinicalNotice(patient.value, session.can('patients:read_clinical'))
    : null,
)

const tabs = computed<TabItem<Section>[]>(() => [
  { key: 'datos', label: 'Datos' },
  { key: 'historia', label: 'Historia clínica' },
  {
    key: 'evaluaciones',
    label: 'Evaluaciones',
    count: evaluations.value?.length ?? null,
  },
  { key: 'asistencia', label: 'Asistencia' },
  { key: 'documentos', label: 'Documentos' },
])

const meta = computed(() => {
  const value = patient.value
  if (!value) return ''
  const parts = [`Carnet ${formatCi(value.ci)}`]
  if (value.birthDate) parts.push(`${ageOn(value.birthDate, todayIso())} años`)
  parts.push(`En ASPAR desde ${monthYear(value.createdAt)}`)
  return parts.join(' · ')
})

async function loadEvaluations() {
  evaluations.value = null
  if (!patient.value?.clinicalAccess) return
  try {
    evaluations.value = await api.evaluations.list(patientId.value)
  } catch {
    // La pestaña Evaluaciones vuelve a intentarlo y muestra el error
  }
}

async function load() {
  loading.value = true
  loadError.value = null
  try {
    patient.value = await api.patients.get(patientId.value)
    crumb.set(patient.value.name)
    await loadEvaluations()
  } catch (error) {
    loadError.value = {
      status: isApiError(error) ? error.status : 0,
      message: isApiError(error)
        ? error.message
        : 'No pudimos abrir la ficha. Intenta de nuevo.',
    }
  } finally {
    loading.value = false
  }
}

function onUpdated(updated: PatientOut) {
  const accessChanged = updated.clinicalAccess !== patient.value?.clinicalAccess
  patient.value = updated
  crumb.set(updated.name)
  if (accessChanged) void loadEvaluations()
}

watch(section, (value) => {
  void router.replace({
    query: value === 'datos' ? {} : { seccion: value },
  })
})

/** Vuelve al listado con la misma pestaña, búsqueda y página. */
function backToList() {
  void router.push(patientsListLocation())
}

const UNSAVED =
  'Hay cambios sin guardar en la ficha. ¿Quieres salir sin guardarlos?'

/** Cambiar de pestaña con cambios sin guardar los perdería: se pregunta antes. */
const sticky = ref<InstanceType<typeof StickyHeader> | null>(null)

function changeSection(next: Section) {
  if (next === section.value) return
  if (dirty.value && !window.confirm(UNSAVED)) return
  dirty.value = false
  section.value = next
  // La pestaña nueva empieza justo debajo del encabezado fijo
  sticky.value?.scrollToStart()
}

onBeforeRouteLeave((to) => {
  if (!dirty.value || to.name === 'ingresar') return true
  return window.confirm(UNSAVED)
})

void load()
</script>

<template>
  <div class="record">
    <button type="button" class="record__back" @click="backToList">
      <span aria-hidden="true">‹</span> Afiliados
    </button>

    <div v-if="loading && !patient" class="record__loading" aria-busy="true">
      <SkeletonBlock width="4.75rem" height="4.75rem" radius="50%" />
      <div class="record__loading-text">
        <SkeletonBlock width="22rem" height="2.4rem" />
        <SkeletonBlock width="16rem" height="1rem" />
      </div>
      <span class="visually-hidden" role="status">Abriendo la ficha…</span>
    </div>

    <section v-else-if="loadError" class="record__missing surface-card">
      <h1>
        {{
          loadError.status === 404
            ? 'No encontramos esta ficha.'
            : 'No pudimos abrir la ficha.'
        }}
      </h1>
      <p>
        {{
          loadError.status === 404
            ? 'Puede que el enlace esté incompleto. Búscala en el listado por nombre o carnet.'
            : loadError.message
        }}
      </p>
      <div class="record__missing-actions">
        <AppButton
          v-if="loadError.status !== 404"
          variant="secondary"
          @click="load"
        >
          Reintentar
        </AppButton>
        <AppButton :to="{ name: 'afiliados' }">Ir al listado</AppButton>
      </div>
    </section>

    <template v-else-if="patient">
      <!-- Nombre, estados y pestañas quedan fijos; el contenido de cada pestaña pasa por debajo -->
      <StickyHeader ref="sticky" v-slot="{ stuck }">
        <div class="record__top" :class="{ 'is-stuck': stuck }">
          <header class="record__header">
            <InitialsAvatar :name="patient.name" :size="stuck ? 'md' : 'xl'" />
            <div class="record__identity">
              <h1>{{ patient.name }}</h1>
              <p class="record__meta">{{ meta }}</p>
              <p class="record__consent">
                <template v-if="patient.consent && patient.consentDate">
                  Consentimiento firmado el {{ longDay(patient.consentDate) }} ·
                  Uso de imagen:
                  <strong>{{
                    patient.imageConsent ? 'autorizado' : 'no autorizado'
                  }}</strong>
                </template>
                <template v-else>Sin consentimiento firmado todavía.</template>
              </p>
            </div>
            <div class="record__badges">
              <StatusBadge :tone="patient.active ? 'success' : 'neutral'">
                {{ patient.active ? 'Activo' : 'Inactivo' }}
              </StatusBadge>
              <StatusBadge
                :tone="patient.consent ? 'success' : 'warning'"
                :dot="false"
              >
                {{
                  patient.consent
                    ? 'Consentimiento firmado'
                    : 'Consentimiento pendiente'
                }}
              </StatusBadge>
            </div>
          </header>

          <AppTabs
            :model-value="section"
            :items="tabs"
            label="Secciones de la ficha"
            id-prefix="ficha"
            @update:model-value="changeSection"
          />
        </div>
      </StickyHeader>

      <AppAlert
        v-if="!patient.active"
        tone="neutral"
        title="Esta ficha está inactiva."
        class="record__inactive"
      >
        <p>
          Motivo: {{ patient.deactivationReason }}. Sus datos, evaluaciones y
          documentos se conservan; para editarla, primero hay que reactivarla.
        </p>
        <AppButton
          v-if="canDeactivate"
          variant="secondary"
          size="sm"
          @click="statusDialog = 'reactivate'"
        >
          Reactivar ficha…
        </AppButton>
      </AppAlert>

      <div
        id="ficha-panel"
        role="tabpanel"
        :aria-labelledby="`ficha-tab-${section}`"
        class="record__panel"
      >
        <DataTab
          v-if="section === 'datos'"
          :patient="patient"
          @updated="onUpdated"
          @dirty="dirty = $event"
          @deactivate="statusDialog = 'deactivate'"
          @show-attendance="changeSection('asistencia')"
        />
        <ClinicalHistoryTab
          v-else-if="section === 'historia'"
          :patient="patient"
          :notice="notice"
          @updated="onUpdated"
          @dirty="dirty = $event"
        />
        <EvaluationsTab
          v-else-if="section === 'evaluaciones'"
          v-model:evaluations="evaluations"
          :patient="patient"
          :notice="notice"
        />
        <AttendanceTab
          v-else-if="section === 'asistencia'"
          :patient-id="patient.id"
        />
        <DocumentsTab v-else :patient="patient" :notice="notice" />
      </div>

      <StatusDialog
        :mode="statusDialog"
        :patient="patient"
        @close="statusDialog = null"
        @updated="onUpdated"
      />
    </template>
  </div>
</template>

<style scoped>
.record {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--space-5);
}

.record__back {
  justify-self: start;
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: calc(-1 * var(--space-2));
  padding: var(--space-1) var(--space-2);
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-link);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.record__back:hover {
  text-decoration: underline;
}

.record__back:focus-visible {
  box-shadow: var(--focus-ring);
}

.record__loading {
  display: flex;
  align-items: center;
  gap: var(--space-5);
}

.record__loading-text {
  display: grid;
  gap: var(--space-3);
}

.record__missing {
  display: grid;
  gap: var(--space-3);
  justify-items: start;
  max-width: 40rem;
  padding: var(--space-8);
}

.record__missing h1 {
  font-size: var(--text-3xl);
}

.record__missing-actions {
  display: flex;
  gap: var(--space-3);
  margin-top: var(--space-2);
}

/* Encabezado fijo: al quedar fijo se achica a una línea con el nombre y los estados */
.record__top {
  display: grid;
  gap: var(--space-5);
}

.record__top.is-stuck {
  gap: var(--space-2);
  padding-top: var(--space-3);
}

.record__top.is-stuck .record__meta,
.record__top.is-stuck .record__consent {
  display: none;
}

.record__top.is-stuck .record__identity h1 {
  font-size: var(--text-2xl);
}

.record__header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-4) var(--space-6);
}

.record__identity {
  flex: 1 1 22rem;
  display: grid;
  gap: var(--space-1);
  min-width: 0;
}

.record__identity h1 {
  font-size: var(--text-4xl);
  line-height: var(--leading-tight);
}

.record__meta {
  color: var(--color-text-muted);
  font-size: var(--text-lg);
  font-variant-numeric: tabular-nums;
}

.record__consent {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}

.record__consent strong {
  color: var(--color-text);
}

.record__badges {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.record__inactive :deep(.alert__text) {
  display: grid;
  gap: var(--space-3);
  justify-items: start;
}

.record__panel {
  min-width: 0;
}

/* En el celular, al quedar fijo solo se ven las pestañas */
@media (max-width: 640px) {
  .record__top.is-stuck .record__header {
    display: none;
  }

  .record__top.is-stuck {
    padding-top: 0;
  }
}
</style>
