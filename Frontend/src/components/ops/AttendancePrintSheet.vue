<script setup lang="ts">
import { computed } from 'vue'

import type { AttendanceSheet } from '../../api/types'
import { dayLabel, timeRange } from '../../utils/ops'
import AsparBrand from '../AsparBrand.vue'

/**
 * Lista de asistencia en papel, por si un sábado falla el internet en la sede. No se ve
 * en la pantalla: solo al imprimir («Imprimir lista»), y entonces es lo único que sale.
 * Trae a todas las personas en orden alfabético, con lo que ya estaba marcado, y renglones
 * para quienes vienen por primera vez. Después se pasa al sistema.
 */
const props = defineProps<{ sheet: AttendanceSheet }>()

/** Renglones en blanco para personas nuevas. */
const NEWCOMER_ROWS = 6

const people = computed(() =>
  [...props.sheet.items].sort((a, b) => a.name.localeCompare(b.name, 'es')),
)
const activity = computed(() => props.sheet.activity)
/** «Sábado, 7 de noviembre · 10:00 – 11:30 · Sede ASPAR · Lic. Ana Flores» */
const details = computed(() =>
  [
    dayLabel(activity.value.date),
    timeRange(activity.value.startTime, activity.value.endTime),
    activity.value.location,
    activity.value.professionalName,
  ]
    .filter(Boolean)
    .join(' · '),
)
const printedAt = computed(() =>
  new Intl.DateTimeFormat('es-BO', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/La_Paz',
  }).format(new Date()),
)
</script>

<template>
  <Teleport to="body">
    <section class="print-sheet" aria-hidden="true">
      <header class="print-sheet__head">
        <AsparBrand />
        <div class="print-sheet__title">
          <p class="print-sheet__name">Lista de asistencia</p>
          <p>
            <strong>{{ activity.title }}</strong>
          </p>
          <p>{{ details }}</p>
        </div>
      </header>

      <p class="print-sheet__how">
        Marca con una ✓ a quien vino y con una ✗ a quien no vino. Lo que ya
        estaba marcado en el sistema sale impreso.
      </p>

      <table class="print-sheet__table">
        <thead>
          <tr>
            <th class="num">N.º</th>
            <th>Nombre</th>
            <th class="box">Vino</th>
            <th class="box">No vino</th>
            <th class="notes">Observaciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(person, index) in people" :key="person.patientId">
            <td class="num">{{ index + 1 }}</td>
            <td>{{ person.name }}</td>
            <td class="box">{{ person.status === 'vino' ? '✓' : '' }}</td>
            <td class="box">{{ person.status === 'no_vino' ? '✗' : '' }}</td>
            <td class="notes">{{ person.note }}</td>
          </tr>
        </tbody>
      </table>

      <p class="print-sheet__sub">Personas que vienen por primera vez</p>
      <table class="print-sheet__table print-sheet__new">
        <thead>
          <tr>
            <th class="num">N.º</th>
            <th>Nombre</th>
            <th>Teléfono</th>
            <th>Viene por (si es para otra persona)</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in NEWCOMER_ROWS" :key="row">
            <td class="num">{{ row }}</td>
            <td />
            <td />
            <td />
          </tr>
        </tbody>
      </table>

      <footer class="print-sheet__foot">
        <span>Tomó la lista: ______________________________</span>
        <span>
          {{ people.length }} personas · impreso el {{ printedAt }} · pásala al
          sistema en «Asistencia»
        </span>
      </footer>
    </section>
  </Teleport>
</template>

<style>
/* En pantalla la hoja no existe; al imprimir, es lo único que sale */
.print-sheet {
  display: none;
}

@media print {
  @page {
    size: A4;
    margin: 14mm 12mm;
  }

  body:has(.print-sheet) > :not(.print-sheet) {
    display: none !important;
  }

  body:has(.print-sheet) {
    background: #fff;
  }

  .print-sheet {
    display: block;
    color: #000;
    font-size: 11pt;
  }

  .print-sheet__head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 8mm;
    padding-bottom: 4mm;
    border-bottom: 2px solid #073930;
  }

  .print-sheet__title {
    text-align: right;
  }

  /* Sin h1 ni h2: la hoja vive junto a la pantalla y no debe sumar títulos */
  .print-sheet__name {
    font-family: var(--font-serif);
    font-size: 18pt;
    color: #073930;
  }

  .print-sheet__sub {
    font-family: var(--font-serif);
    font-size: 12pt;
    color: #073930;
  }

  .print-sheet p {
    margin: 0;
  }

  .print-sheet .print-sheet__name {
    margin: 0 0 1mm;
  }

  .print-sheet .print-sheet__sub {
    margin: 6mm 0 2mm;
    font-weight: 600;
  }

  .print-sheet__how {
    margin: 3mm 0 !important;
    font-size: 9.5pt;
    color: #333;
  }

  .print-sheet__table {
    width: 100%;
    border-collapse: collapse;
  }

  .print-sheet__table th,
  .print-sheet__table td {
    height: 8.5mm;
    padding: 0 2mm;
    border: 1px solid #555;
    text-align: left;
  }

  .print-sheet__table th {
    background: #eee;
    font-size: 9.5pt;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .print-sheet__table tr {
    break-inside: avoid;
  }

  .print-sheet__table .num {
    width: 10mm;
    text-align: center;
  }

  .print-sheet__table .box {
    width: 16mm;
    text-align: center;
    font-size: 13pt;
  }

  .print-sheet__table th.box {
    font-size: 9.5pt;
    white-space: nowrap;
  }

  .print-sheet__table .notes {
    width: 55mm;
    font-size: 9.5pt;
  }

  .print-sheet__new {
    break-inside: avoid;
  }

  .print-sheet__foot {
    display: flex;
    justify-content: space-between;
    gap: 6mm;
    margin-top: 8mm;
    font-size: 9pt;
    color: #333;
  }
}
</style>
