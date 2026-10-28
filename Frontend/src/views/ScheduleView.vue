<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import {
  addMediaAsset,
  getDonations,
  getMediaAssets,
  getSession,
  institutionalInfo,
  registerDonation,
  schedule,
} from '../services/aspar'

const mediaAssets = ref(getMediaAssets())
// RF-05: el público solo ve la galería; la carga es para el personal con sesión
const canUploadMedia = getSession() !== null
const donations = ref(getDonations())
const donationSuccess = ref('')

const donationForm = reactive({
  donorName: '',
  amountBs: 100,
  method: 'QR Bancario' as 'QR Bancario' | 'Pasarela Libélula',
  purpose: 'Equipamiento de fisioterapia y espacio propio ASPAR',
})

const mediaForm = reactive({
  title: '',
  type: 'Imagen' as 'Imagen' | 'Video',
  category: 'Actividades Sabatinas',
  sizeMb: 3.5,
})

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

function submitDonation() {
  const record = registerDonation(
    donationForm.donorName,
    Number(donationForm.amountBs) || 50,
    donationForm.method,
    donationForm.purpose,
  )
  donations.value = getDonations()
  donationSuccess.value = `Aporte registrado por Bs. ${record.amountBs} vía ${record.method}. ¡Gracias por apoyar a ASPAR!`
  donationForm.donorName = ''
}

function submitMedia() {
  if (!canUploadMedia || !mediaForm.title.trim()) return
  addMediaAsset(
    mediaForm.title,
    mediaForm.type,
    mediaForm.category,
    Number(mediaForm.sizeMb) || 2.0,
  )
  mediaAssets.value = getMediaAssets()
  mediaForm.title = ''
}
</script>

<template>
  <section class="hero">
    <div>
      <span class="eyebrow">
        Asociación de Parkinson "Mario Lagrava" · RF-07 / RF-10
      </span>
      <h1>Actividades para acompañarte.</h1>
      <p>
        {{ institutionalInfo.mission }} Inspirados en el modelo clínico y
        comunitario de {{ institutionalInfo.inspirationModel }}.
      </p>
      <div class="social-links" aria-label="Redes sociales oficiales de ASPAR">
        <a
          :href="institutionalInfo.socialLinks.facebook"
          target="_blank"
          rel="noopener noreferrer"
          class="button button-small button-secondary"
        >
          Facebook Oficial
        </a>
        <a
          :href="institutionalInfo.socialLinks.instagram"
          target="_blank"
          rel="noopener noreferrer"
          class="button button-small button-secondary"
        >
          Instagram Oficial
        </a>
        <a
          :href="institutionalInfo.socialLinks.tiktok"
          target="_blank"
          rel="noopener noreferrer"
          class="button button-small button-secondary"
        >
          TikTok Oficial
        </a>
      </div>
    </div>

    <div class="hero-badge" aria-hidden="true">ASPAR</div>
  </section>

  <section class="section-block">
    <div class="section-title">
      <div>
        <span class="eyebrow">Próximos encuentros · RF-04 / RF-10</span>
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
            {{ formatDate(item.date) }} · {{ item.time }} · {{ item.category }}
          </span>

          <h3>{{ item.title }}</h3>

          <p>
            {{ item.professional }} · {{ item.location }} · Cupos:
            {{ item.spots }}
          </p>
        </div>

        <span class="open-label">Abierto</span>
      </article>
    </div>

    <div v-else class="card empty-state">
      Aún no hay actividades programadas.
    </div>
  </section>

  <section class="section-block">
    <div class="section-title">
      <div>
        <span class="eyebrow"
          >Almacenamiento Cloud S3 / Cloudinary · RF-05</span
        >
        <h2>Galería Multimedia de Jornadas Sabatinas</h2>
      </div>
      <span class="count-pill">{{ mediaAssets.length }} archivos en Cloud</span>
    </div>

    <div class="portal-grid">
      <article
        v-for="asset in mediaAssets"
        :key="asset.id"
        class="card form-card"
      >
        <span class="eyebrow">{{ asset.type }} · {{ asset.category }}</span>
        <h3>{{ asset.title }}</h3>
        <p class="muted">
          Proveedor: {{ asset.storageProvider }} ({{ asset.sizeMb }} MB) ·
          Fecha: {{ asset.uploadedAt }}
        </p>
      </article>

      <form
        v-if="canUploadMedia"
        class="card form-card"
        @submit.prevent="submitMedia"
      >
        <h3>Subir foto o video a Cloud Storage</h3>
        <label for="media-title">Título de la actividad</label>
        <input
          id="media-title"
          v-model.trim="mediaForm.title"
          placeholder="Ej. Taller de fisioterapia sabatina"
          required
        />
        <label for="media-type">Tipo de archivo</label>
        <select id="media-type" v-model="mediaForm.type">
          <option value="Imagen">Imagen optimizada</option>
          <option value="Video">Video HD (> 5 MB)</option>
        </select>
        <button class="button button-secondary full-width" type="submit">
          Subir a Cloud Storage (RF-05)
        </button>
      </form>
    </div>
  </section>

  <section class="section-block">
    <div class="section-title">
      <div>
        <span class="eyebrow">Captación de Fondos y Transparencia · RF-06</span>
        <h2>Módulo de Donaciones (QR Bancario y Pasarela Libélula)</h2>
      </div>
      <span class="count-pill">{{ donations.length }} aportes verificados</span>
    </div>

    <div class="portal-grid">
      <div class="card form-card">
        <h3>Código QR Oficial ASPAR</h3>
        <p>
          Escanea el QR institucional o utiliza la pasarela
          <strong>Libélula</strong> para apoyar la compra de balones
          terapéuticos, colchonetas y el fondo pro-sede propia de ASPAR.
        </p>
        <div class="qr-box" aria-label="Código QR Bancario Oficial ASPAR">
          <strong>QR BANCO ASPAR · CUENTA OFICIAL</strong>
          <small>Asociación de Parkinson "Mario Lagrava" · La Paz</small>
        </div>
        <h4>Requisitos de afiliación (RF-07):</h4>
        <ul class="req-list">
          <li
            v-for="req in institutionalInfo.enrollmentRequirements"
            :key="req"
          >
            {{ req }}
          </li>
        </ul>
      </div>

      <form class="card form-card" @submit.prevent="submitDonation">
        <h3>Registrar aporte solidario (Pasarela Libélula / QR)</h3>
        <label for="donor-name">Nombre del donante</label>
        <input
          id="donor-name"
          v-model.trim="donationForm.donorName"
          placeholder="Nombre o Anónimo"
        />

        <label for="donor-amount">Monto en Bolivianos (Bs.)</label>
        <input
          id="donor-amount"
          v-model.number="donationForm.amountBs"
          type="number"
          min="10"
          required
        />

        <label for="donor-method">Método de pago</label>
        <select id="donor-method" v-model="donationForm.method">
          <option value="QR Bancario">QR Bancario Oficial</option>
          <option value="Pasarela Libélula">Pasarela de Pagos Libélula</option>
        </select>

        <p v-if="donationSuccess" class="success-message" role="status">
          {{ donationSuccess }}
        </p>

        <button class="button button-primary full-width" type="submit">
          Procesar donación solidaria
        </button>
      </form>
    </div>
  </section>
</template>
