<script setup lang="ts">
/** Asistencia: «X de Y sábados este trimestre» y el historial, del más reciente. */
import { ref } from 'vue'

import { isApiError } from '../../../api/errors'
import type { PatientAttendancePage } from '../../../api/types'
import { useApi } from '../../../composables/useApi'
import { shortDay } from '../../../utils/format'
import AppAlert from '../../ui/AppAlert.vue'
import AppButton from '../../ui/AppButton.vue'
import AppPagination from '../../ui/AppPagination.vue'
import DataTable, { type Column } from '../../ui/DataTable.vue'
import StatusBadge from '../../ui/StatusBadge.vue'

const props = defineProps<{ patientId: string }>()

const PAGE_SIZE = 10
const { api } = useApi()

const page = ref<PatientAttendancePage | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

const columns: Column[] = [
  { key: 'date', label: 'Fecha' },
  { key: 'title', label: 'Actividad' },
  { key: 'status', label: 'Asistencia' },
  { key: 'note', label: 'Nota' },
]

async function load(offset = 0) {
  loading.value = true
  error.value = null
  try {
    page.value = await api.patients.attendance(props.patientId, {
      limit: PAGE_SIZE,
      offset,
    })
  } catch (failure) {
    error.value = isApiError(failure)
      ? failure.message
      : 'No pudimos cargar la asistencia.'
  } finally {
    loading.value = false
  }
}

void load()
</script>

<template>
  <div class="attendance">
    <AppAlert v-if="error" tone="error">
      {{ error }}
      <AppButton variant="link" size="sm" @click="load(page?.offset ?? 0)">
        Reintentar
      </AppButton>
    </AppAlert>

    <section
      v-if="page"
      class="attendance__summary surface-card"
      aria-labelledby="asistencia-trimestre"
    >
      <h2 id="asistencia-trimestre">Este trimestre</h2>
      <p class="attendance__number">
        <strong>{{ page.saturdaysAttended }}</strong>
        de {{ page.saturdaysHeld }}
        {{ page.saturdaysHeld === 1 ? 'sábado' : 'sábados' }}
      </p>
      <p class="attendance__note">
        Sábados con actividades publicadas de {{ page.quarterLabel }}.
      </p>
    </section>

    <section
      class="attendance__history surface-card"
      aria-labelledby="asistencia-historial"
    >
      <h2 id="asistencia-historial">Historial</h2>
      <DataTable
        :columns="columns"
        :rows="page?.items ?? []"
        :row-key="(row) => `${row.scheduleId}`"
        :loading="loading && !page"
        :skeleton-rows="4"
        caption="Historial de asistencia"
        sticky-head
      >
        <template #cell-date="{ row }">
          <span class="nowrap">{{ shortDay(row.date) }}</span>
        </template>
        <template #cell-title="{ row }">
          <span class="activity">
            <strong>{{ row.title }}</strong>
            <small>{{ row.categoryLabel }}</small>
          </span>
        </template>
        <template #cell-status="{ row }">
          <StatusBadge :tone="row.status === 'vino' ? 'success' : 'neutral'">
            {{ row.status === 'vino' ? 'Vino' : 'No vino' }}
          </StatusBadge>
        </template>
        <template #cell-note="{ row }">
          <span v-if="row.note">{{ row.note }}</span>
          <span v-else class="muted">—</span>
        </template>
        <template #empty>
          Todavía no hay asistencias registradas para esta persona.
        </template>
      </DataTable>
      <AppPagination
        v-if="page && page.total > PAGE_SIZE"
        :total="page.total"
        :limit="PAGE_SIZE"
        :offset="page.offset"
        :count="page.items.length"
        label="Páginas del historial de asistencia"
        @change="load"
      />
    </section>
  </div>
</template>

<style scoped>
.attendance {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--space-5);
}

.attendance__summary {
  grid-template-columns: auto 1fr;
  align-items: baseline;
  column-gap: var(--space-6);
}

.attendance__summary h2 {
  grid-column: 1 / -1;
}

.attendance__summary,
.attendance__history {
  display: grid;
  gap: var(--space-3);
  min-width: 0;
  padding: var(--space-5) var(--space-6);
}

.attendance h2 {
  font-family: var(--font-sans);
  font-size: var(--text-xl);
  font-weight: 700;
  color: var(--color-text);
}

.attendance__number {
  color: var(--color-text-muted);
  font-size: var(--text-lg);
}

.attendance__number strong {
  margin-right: var(--space-1);
  color: var(--aspar-verde);
  font-family: var(--font-serif);
  font-size: var(--text-4xl);
  font-weight: 500;
}

.attendance__note {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}

.activity {
  display: grid;
}

.activity small,
.muted {
  color: var(--color-text-muted);
}

.nowrap {
  white-space: nowrap;
}
</style>
