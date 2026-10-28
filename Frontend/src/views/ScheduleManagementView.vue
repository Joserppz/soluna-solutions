<script setup lang="ts">
import { reactive, ref } from 'vue'
import {
  SCHEDULE_CATEGORIES,
  deleteScheduleItem,
  getSchedule,
  saveScheduleItem,
  setSchedulePublished,
  type ScheduleItem,
} from '../services/aspar'

const activities = ref<ScheduleItem[]>(getSchedule())
const editingId = ref<string | null>(null)
const error = ref('')
const successMsg = ref('')

function emptyForm() {
  return {
    title: '',
    category: 'Fisioterapia' as ScheduleItem['category'],
    date: '',
    time: '09:00',
    professional: '',
    location: 'Sede ASPAR',
    spots: 15,
    published: true,
  }
}

const form = reactive(emptyForm())

function refresh() {
  activities.value = getSchedule()
}

function resetForm() {
  editingId.value = null
  Object.assign(form, emptyForm())
}

function submitActivity() {
  error.value = ''
  successMsg.value = ''
  try {
    const saved = saveScheduleItem(
      { ...form, spots: Number(form.spots) },
      editingId.value ?? undefined,
    )
    successMsg.value = editingId.value
      ? `Actividad «${saved.title}» actualizada.`
      : `Actividad «${saved.title}» agregada al cronograma${saved.published ? ' y publicada en el portal' : ''}.`
    resetForm()
    refresh()
  } catch (cause) {
    error.value =
      cause instanceof Error
        ? cause.message
        : 'No se pudo guardar la actividad.'
  }
}

function startEdit(activity: ScheduleItem) {
  error.value = ''
  successMsg.value = ''
  editingId.value = activity.id
  Object.assign(form, {
    title: activity.title,
    category: activity.category,
    date: activity.date,
    time: activity.time,
    professional: activity.professional,
    location: activity.location,
    spots: activity.spots,
    published: activity.published ?? true,
  })
}

function togglePublished(activity: ScheduleItem) {
  error.value = ''
  setSchedulePublished(activity.id, !activity.published)
  successMsg.value = activity.published
    ? `«${activity.title}» ya no se muestra en el portal.`
    : `«${activity.title}» se publicó en el portal.`
  refresh()
}

function removeActivity(activity: ScheduleItem) {
  error.value = ''
  const confirmed = window.confirm(
    `¿Eliminar «${activity.title}» del ${formatDate(activity.date)}? Esta acción no se puede deshacer.`,
  )
  if (!confirmed) return
  deleteScheduleItem(activity.id)
  if (editingId.value === activity.id) resetForm()
  successMsg.value = `Actividad «${activity.title}» eliminada.`
  refresh()
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat('es-BO', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${date}T12:00:00`))
}
</script>

<template>
  <section class="page-heading">
    <span class="eyebrow"
      >Cronograma · RF-04 / RF-10 (SCRUM-16 / SCRUM-74)</span
    >
    <h1>Gestión del cronograma de actividades</h1>
    <p>
      Crea, edita y publica las actividades sabatinas. Las actividades
      publicadas aparecen en el portal público sin iniciar sesión.
    </p>
  </section>

  <form
    class="card form-card wide-card"
    novalidate
    @submit.prevent="submitActivity"
  >
    <h2>{{ editingId ? 'Editar actividad' : 'Nueva actividad' }}</h2>

    <div class="form-grid">
      <div class="field">
        <label for="sched-title">Título de la actividad</label>
        <input
          id="sched-title"
          v-model="form.title"
          placeholder="Ej. Terapia física grupal y equilibrio"
          required
        />
      </div>

      <div class="field">
        <label for="sched-category">Categoría</label>
        <select id="sched-category" v-model="form.category">
          <option
            v-for="category in SCHEDULE_CATEGORIES"
            :key="category"
            :value="category"
          >
            {{ category }}
          </option>
        </select>
      </div>

      <div class="field">
        <label for="sched-date">Fecha</label>
        <input id="sched-date" v-model="form.date" type="date" required />
      </div>

      <div class="field">
        <label for="sched-time">Hora</label>
        <input id="sched-time" v-model="form.time" type="time" required />
      </div>

      <div class="field">
        <label for="sched-professional">Profesional a cargo</label>
        <input
          id="sched-professional"
          v-model="form.professional"
          placeholder="Ej. Lic. Ana Flores"
          required
        />
      </div>

      <div class="field">
        <label for="sched-location">Lugar</label>
        <input
          id="sched-location"
          v-model="form.location"
          placeholder="Ej. Sala de rehabilitación"
          required
        />
      </div>

      <div class="field">
        <label for="sched-spots">Cupos</label>
        <input
          id="sched-spots"
          v-model.number="form.spots"
          type="number"
          min="0"
          max="200"
        />
      </div>

      <label class="checkbox-field">
        <input id="sched-published" v-model="form.published" type="checkbox" />
        Publicar en el portal público
      </label>
    </div>

    <p v-if="error" class="form-error" role="alert">{{ error }}</p>
    <p v-if="successMsg" class="success-message" role="status">
      {{ successMsg }}
    </p>

    <div class="form-actions">
      <button
        v-if="editingId"
        class="button button-secondary"
        type="button"
        @click="resetForm"
      >
        Cancelar edición
      </button>
      <button class="button button-primary" type="submit">
        {{ editingId ? 'Guardar cambios' : 'Agregar actividad' }}
      </button>
    </div>

    <p class="muted field-note">
      Mientras el Backend no publique la API de cronogramas (SCRUM-37), los
      cambios se guardan en este navegador.
    </p>
  </form>

  <section class="card table-card patient-list">
    <div class="section-title table-heading">
      <div>
        <h2>Actividades programadas</h2>
        <p class="muted">{{ activities.length }} actividades</p>
      </div>
    </div>

    <article
      v-for="activity in activities"
      :key="activity.id"
      class="patient-row schedule-admin-row"
    >
      <div class="patient-main">
        <strong>{{ activity.title }}</strong>
        <small>
          {{ formatDate(activity.date) }} · {{ activity.time }} ·
          {{ activity.category }}
        </small>
        <small>
          {{ activity.professional }} · {{ activity.location }} ·
          {{ activity.spots }} cupos
        </small>
      </div>

      <span
        class="consent-pill"
        :class="activity.published ? 'consent-ok' : 'consent-blocked'"
      >
        {{ activity.published ? 'Publicada' : 'Oculta' }}
      </span>

      <div class="row-actions">
        <button
          class="button button-small button-secondary"
          type="button"
          @click="startEdit(activity)"
        >
          Editar
        </button>
        <button
          class="button button-small button-secondary"
          type="button"
          @click="togglePublished(activity)"
        >
          {{ activity.published ? 'Ocultar' : 'Publicar' }}
        </button>
        <button
          class="button button-small button-absent"
          type="button"
          @click="removeActivity(activity)"
        >
          Eliminar
        </button>
      </div>
    </article>

    <p v-if="activities.length === 0" class="empty-state">
      No hay actividades. Agrega la primera con el formulario.
    </p>
  </section>
</template>
