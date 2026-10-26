<script setup lang="ts">
import { computed } from 'vue'
import { schedule } from '../services/aspar'

const sesionesOrdenadas = computed(() =>
  [...schedule].sort((a, b) => {
    const fechaA = `${a.date} ${a.time}`
    const fechaB = `${b.date} ${b.time}`
    return fechaA.localeCompare(fechaB)
  }),
)

function getDate(date: string): Date {
  return new Date(`${date}T12:00:00`)
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat('es-BO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(getDate(date))
}

function getDayNumber(date: string): number {
  return getDate(date).getDate()
}

function getShortMonth(date: string): string {
  return new Intl.DateTimeFormat('es-BO', {
    month: 'short',
  }).format(getDate(date))
}
</script>

<template>
  <section class="hero">
    <div>
      <span class="eyebrow">Fundación ASPAR</span>
      <h1>Actividades para acompañarte.</h1>
      <p>
        Consulta los próximos encuentros, terapias y espacios de bienestar.
      </p>
    </div>

    <div class="hero-badge" aria-hidden="true">ASPAR</div>
  </section>

  <section class="section-block">
    <div class="section-title">
      <div>
        <span class="eyebrow">Próximos encuentros</span>
        <h2>Cronograma</h2>
      </div>

      <span class="count-pill">
        {{ sesionesOrdenadas.length }} actividades
      </span>
    </div>

    <div v-if="sesionesOrdenadas.length > 0" class="schedule-list">
      <article
        v-for="item in sesionesOrdenadas"
        :key="item.id"
        class="card schedule-card"
      >
        <div class="date-tile">
          <span>{{ getDayNumber(item.date) }}</span>
          <small>{{ getShortMonth(item.date) }}</small>
        </div>

        <div class="schedule-info">
          <span class="schedule-date">
            {{ formatDate(item.date) }} · {{ item.time }}
          </span>

          <h3>{{ item.title }}</h3>

          <p>
            {{ item.professional }} · {{ item.location }}
          </p>
        </div>

        <span class="open-label">Abierto</span>
      </article>
    </div>

    <div v-else class="card empty-state">
      Aún no hay actividades programadas.
    </div>
  </section>
</template>