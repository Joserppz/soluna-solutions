<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { isApiError } from '../../api/errors'
import type { DonationTracking, PublicGoal } from '../../api/types'
import supportPhoto from '../../assets/sitio/apoya.webp'
import TurnstileWidget from '../../components/auth/TurnstileWidget.vue'
import SiteLink from '../../components/public/SiteLink.vue'
import AppAlert from '../../components/ui/AppAlert.vue'
import AppButton from '../../components/ui/AppButton.vue'
import FormField from '../../components/ui/FormField.vue'
import SkeletonBlock from '../../components/ui/SkeletonBlock.vue'
import StatusBadge from '../../components/ui/StatusBadge.vue'
import { useApi } from '../../composables/useApi'
import { useSiteContent } from '../../composables/useSiteContent'
import { useToast } from '../../composables/useToast'
import { whenLabel } from '../../utils/format'
import {
  AMOUNTS,
  AMOUNT_IMPACT,
  bs,
  parseAmount,
  qrDownloadUrl,
  text,
  trackingSteps,
} from '../../utils/site'

/**
 * «Apoya a ASPAR» (diseño págs. 4 y 5), en escritorio y en el celular: elegir el
 * aporte, pagar con el QR bancario de ASPAR (sin pasarela) y avisar del aporte
 * (`POST /public/donations/notice`). Después, el aviso se sigue en tres pasos con
 * `?aviso=…`. La meta se muestra en vivo (`GET /public/donations/goal`).
 */
const { api } = useApi()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const { content, ready, load } = useSiteContent()

const DEFAULT_PURPOSE = 'Donde más se necesite'
const MILESTONES: Record<string, string> = {
  cubierto: '✓ cubierto',
  en_camino: 'en camino',
  pendiente: 'pendiente',
}

const goal = ref<PublicGoal | null>(null)
const goalLoaded = ref(false)
const choice = ref<number | 'otro'>(100)
const other = ref('')

const form = reactive({
  name: '',
  contact: '',
  amount: '100',
  reference: '',
  purpose: DEFAULT_PURPOSE,
})
const touched = ref(false)
const token = ref<string | null>(null)
const turnstile = ref<InstanceType<typeof TurnstileWidget> | null>(null)
const sending = ref(false)
const failure = ref<string | null>(null)

const tracking = ref<DonationTracking | null>(null)
const thanksName = ref('')
const trackingFailed = ref(false)
const refreshing = ref(false)

const chosenAmount = computed(() =>
  choice.value === 'otro' ? parseAmount(other.value) : choice.value,
)
const impact = computed(() =>
  typeof choice.value === 'number' ? AMOUNT_IMPACT[choice.value] : null,
)
const qrUrl = computed(() => text(content.value, 'donaciones', 'qrUrl'))
const account = computed(() => ({
  holder: text(
    content.value,
    'donaciones',
    'titular',
    'Asociación de Parkinson «Mario Lagrava»',
  ),
  bank: text(content.value, 'donaciones', 'banco'),
  number: text(content.value, 'donaciones', 'cuenta'),
}))
const purposes = computed(() => {
  const list = [DEFAULT_PURPOSE]
  if (goal.value?.title) list.push(goal.value.title)
  list.push('Materiales para los talleres')
  return list
})
const progress = computed(() =>
  goal.value ? Math.min(100, Math.max(0, goal.value.percent)) : 0,
)
const steps = computed(() =>
  tracking.value ? trackingSteps(tracking.value.status) : null,
)

const errors = computed(() => {
  if (!touched.value) return { amount: null, captcha: null }
  return {
    amount: parseAmount(form.amount)
      ? null
      : 'Escribe el monto que transferiste (por ejemplo, 100).',
    captcha: token.value ? null : 'Completa la verificación de seguridad.',
  }
})

// El monto del aviso sigue al que se eligió en el paso 1
watch(chosenAmount, (amount) => {
  if (amount) form.amount = String(amount)
})

function choose(value: number | 'otro') {
  choice.value = value
}

function toStep(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
}

async function notify() {
  touched.value = true
  failure.value = null
  if (Object.values(errors.value).some(Boolean)) return
  sending.value = true
  try {
    const result = await api.public.notifyDonation({
      donorName: form.name.trim() || null,
      donorContact: form.contact.trim() || null,
      amountBs: parseAmount(form.amount)!,
      declaredReference: form.reference.trim() || null,
      purpose: form.purpose,
      turnstileToken: token.value!,
    })
    tracking.value = result
    thanksName.value = form.name.trim().split(/\s+/)[0] ?? ''
    await router.replace({ query: { aviso: result.id } })
    await nextTick()
    document
      .getElementById('gracias')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  } catch (error) {
    failure.value = isApiError(error)
      ? error.message
      : 'No pudimos registrar tu aviso. Revisa tu conexión e inténtalo de nuevo.'
  } finally {
    sending.value = false
    // El token de verificación sirve una sola vez
    turnstile.value?.reset()
  }
}

async function track(id: string) {
  trackingFailed.value = false
  refreshing.value = true
  try {
    tracking.value = await api.public.trackDonation(id)
  } catch {
    trackingFailed.value = true
  } finally {
    refreshing.value = false
  }
}

async function share() {
  const url = `${window.location.origin}/apoyar`
  const data = {
    title: 'Apoya a ASPAR',
    text: 'Ayudemos a ASPAR a hacer lugar para más encuentros.',
    url,
  }
  try {
    if (navigator.share) {
      await navigator.share(data)
      return
    }
    await navigator.clipboard.writeText(url)
    toast.success('Copiamos el enlace para que lo compartas.')
  } catch {
    // La persona canceló el menú de compartir: no hace falta avisar
  }
}

async function startOver() {
  tracking.value = null
  trackingFailed.value = false
  touched.value = false
  form.reference = ''
  await router.replace({ query: {} })
}

watch(
  () => route.query.aviso,
  (id) => {
    if (typeof id === 'string' && id && tracking.value?.id !== id)
      void track(id)
    if (!id) tracking.value = null
  },
  { immediate: true },
)

onMounted(() => {
  void load()
  api.public
    .donationGoal()
    .then((value) => (goal.value = value))
    .catch(() => (goal.value = null))
    .finally(() => (goalLoaded.value = true))
})
</script>

<template>
  <div class="support">
    <section class="hero" aria-labelledby="titulo-apoyar">
      <div>
        <span class="eyebrow">Apoya a ASPAR</span>
        <h1 id="titulo-apoyar">
          Ayúdanos a hacer lugar para <em>más encuentros.</em>
        </h1>
        <p class="hero__lead">
          Soñamos con un espacio propio y con equipos para la fisioterapia de
          los sábados. Cada aporte, grande o pequeño, nos acerca a recibir a más
          personas y a sus familias.
        </p>
        <ul class="hero__facts">
          <li>
            <i aria-hidden="true">✓</i>Pagas desde la app de tu banco: tus datos
            no pasan por ASPAR
          </li>
          <li><i aria-hidden="true">✓</i>Puedes donar sin dar tu nombre</li>
        </ul>
      </div>
      <div class="hero__photo">
        <img
          :src="supportPhoto"
          alt="Una sesión de movimiento en la sede de ASPAR"
          width="900"
          height="566"
        />
        <p v-if="goal" class="hero__stamp">
          <b>{{ bs(goal.raisedBs) }}</b>
          <span>reunidos para<br />nuestra meta</span>
        </p>
      </div>
    </section>

    <div class="body">
      <!-- Después de avisar: en qué paso está el aporte -->
      <section
        v-if="tracking || route.query.aviso"
        id="gracias"
        class="card thanks"
        aria-labelledby="titulo-gracias"
        aria-live="polite"
      >
        <template v-if="tracking">
          <div class="thanks__head">
            <span class="thanks__seal" aria-hidden="true">♥</span>
            <div>
              <h2 id="titulo-gracias">
                {{ thanksName ? `¡Gracias, ${thanksName}!` : '¡Gracias!' }}
              </h2>
              <p v-if="tracking.status === 'anulado'">
                Revisamos tu aviso de
                <b>{{ bs(tracking.amountBs) }}</b> y no lo encontramos en
                nuestra cuenta. Si crees que es un error, escríbenos con tu
                comprobante.
              </p>
              <p v-else-if="steps![2] === 'done'">
                Tu aporte de <b>{{ bs(tracking.amountBs) }}</b> ya está en
                nuestra cuenta y suma a la meta.
              </p>
              <p v-else>
                Registramos tu aporte de
                <b>{{ bs(tracking.amountBs) }}</b> por QR bancario. Lo
                confirmaremos en cuanto aparezca en nuestra cuenta.
              </p>
            </div>
          </div>
          <ol class="track" aria-label="Estado de tu aporte">
            <li :class="`is-${steps![0]}`">
              <span class="track__dot" aria-hidden="true">✓</span>
              <div>
                <b>Recibimos tu aviso</b>
                <small>{{ whenLabel(tracking.createdAt) }}</small>
              </div>
            </li>
            <li :class="`is-${steps![1]}`">
              <span class="track__dot" aria-hidden="true">{{
                steps![1] === 'done' ? '✓' : steps![1] === 'cancelled' ? '✕' : 2
              }}</span>
              <div>
                <b>Lo revisamos con el banco</b>
                <small>{{
                  steps![1] === 'cancelled'
                    ? 'No apareció en nuestra cuenta'
                    : 'Suele tomar uno o dos días hábiles'
                }}</small>
              </div>
            </li>
            <li :class="`is-${steps![2]}`">
              <span class="track__dot" aria-hidden="true">{{
                steps![2] === 'done' ? '✓' : 3
              }}</span>
              <div>
                <b>Confirmado</b>
                <small>Y suma a nuestra meta</small>
              </div>
            </li>
          </ol>
          <p class="thanks__status">
            Estado:
            <StatusBadge
              :tone="
                steps![2] === 'done'
                  ? 'success'
                  : tracking.status === 'anulado'
                    ? 'neutral'
                    : 'warning'
              "
              >{{ tracking.statusLabel }}</StatusBadge
            >
            <span class="text-muted">
              Guarda esta página para ver cómo va tu aporte.
            </span>
          </p>
          <div class="thanks__actions">
            <AppButton
              variant="secondary"
              :loading="refreshing"
              loading-label="Revisando…"
              @click="track(tracking.id)"
            >
              Ver cómo va
            </AppButton>
            <AppButton variant="secondary" @click="share">
              Compartir con alguien
            </AppButton>
            <AppButton variant="ghost" :to="{ name: 'inicio' }">
              Volver al inicio
            </AppButton>
            <AppButton variant="ghost" @click="startOver">
              Hacer otro aporte
            </AppButton>
          </div>
        </template>
        <AppAlert v-else-if="trackingFailed" tone="warning">
          No encontramos ese aviso. Revisa el enlace o
          <button type="button" class="inline-link" @click="startOver">
            avísanos de tu aporte otra vez</button
          >.
        </AppAlert>
        <SkeletonBlock v-else height="14rem" />
      </section>

      <div v-else class="steps">
        <section class="card" aria-labelledby="paso-1-titulo">
          <h2 id="paso-1-titulo" class="step"><span>1</span>Elige tu aporte</h2>
          <p class="card__hint">
            Montos en bolivianos. Elige el que sea adecuado para ti.
          </p>
          <div class="amounts" role="radiogroup" aria-label="Monto del aporte">
            <button
              v-for="amount in AMOUNTS"
              :key="amount"
              type="button"
              role="radio"
              :aria-checked="choice === amount"
              :class="{ 'is-on': choice === amount }"
              @click="choose(amount)"
            >
              {{ bs(amount) }}
            </button>
            <button
              type="button"
              role="radio"
              :aria-checked="choice === 'otro'"
              :class="{ 'is-on': choice === 'otro' }"
              @click="choose('otro')"
            >
              Otro monto
            </button>
          </div>
          <FormField
            v-if="choice === 'otro'"
            id="otro-monto"
            v-slot="{ id }"
            label="¿Cuánto quieres aportar? (Bs.)"
          >
            <input
              :id="id"
              v-model="other"
              class="input"
              inputmode="decimal"
              placeholder="Por ejemplo, 150"
            />
          </FormField>
          <div v-if="goal" class="mini-goal" aria-hidden="true">
            <p>
              <b>{{ bs(goal.raisedBs) }}</b>
              <span>de {{ bs(goal.targetBs) }}</span>
            </p>
            <div class="goal__bar">
              <i :style="{ width: `${progress}%` }" />
            </div>
            <small>{{ goal.title }}</small>
          </div>
          <p v-if="impact" class="impact">
            Con <b>{{ bs(choice as number) }}</b> {{ impact }}
          </p>
        </section>

        <section id="paso-2" class="card" aria-labelledby="paso-2-titulo">
          <h2 id="paso-2-titulo" class="step">
            <span>2</span>Paga con el QR bancario
          </h2>
          <div class="qr">
            <div class="qr__code">
              <img
                v-if="qrUrl"
                :src="qrUrl"
                alt="Código QR de la cuenta bancaria de ASPAR"
              />
              <SkeletonBlock v-else-if="!ready" height="100%" />
              <p v-else class="qr__missing">
                El código QR se publica en unos días.
              </p>
            </div>
            <div>
              <h3>Transfiere desde la app de tu banco</h3>
              <ol>
                <li>Abre tu app y elige <b>pagar con QR</b>.</li>
                <li>
                  Escanea el código e ingresa
                  <b>{{ chosenAmount ? bs(chosenAmount) : 'el monto' }}</b
                  >.
                </li>
                <li>Guarda el comprobante y avísanos abajo.</li>
              </ol>
              <p class="qr__account">
                Cuenta a nombre de {{ account.holder }}
                <template v-if="account.bank">· {{ account.bank }}</template>
                <template v-if="account.number">
                  · Nro. {{ account.number }}
                </template>
              </p>
              <AppButton
                v-if="qrUrl"
                variant="secondary"
                size="sm"
                :href="qrDownloadUrl(qrUrl)"
                download="qr-aspar.png"
                target="_blank"
                rel="noopener"
              >
                Guardar el QR en mi teléfono
              </AppButton>
              <p v-else-if="ready" class="qr__account">
                Mientras tanto, puedes
                <SiteLink
                  :to="{
                    name: 'inicio',
                    query: { motivo: 'otro' },
                    hash: '#contacto',
                  }"
                  >pedirnos los datos de la cuenta</SiteLink
                >.
              </p>
            </div>
          </div>
        </section>

        <section id="paso-3" class="card" aria-labelledby="paso-3-titulo">
          <h2 id="paso-3-titulo" class="step">
            <span>3</span>Avísanos de tu aporte
          </h2>
          <p class="card__hint">
            Así podemos confirmarlo con el banco y agradecerte.
          </p>
          <form class="notice" novalidate @submit.prevent="notify">
            <FormField
              id="aviso-nombre"
              v-slot="{ id }"
              label="Tu nombre"
              hint="Opcional: puedes quedar en el anonimato."
            >
              <input
                :id="id"
                v-model="form.name"
                class="input"
                autocomplete="name"
                maxlength="120"
              />
            </FormField>
            <FormField
              id="aviso-monto"
              v-slot="{ id, describedBy, invalid }"
              label="Monto (Bs.)"
              required
              :error="errors.amount"
            >
              <input
                :id="id"
                v-model="form.amount"
                class="input"
                inputmode="decimal"
                :aria-describedby="describedBy"
                :aria-invalid="invalid"
              />
            </FormField>
            <FormField
              id="aviso-comprobante"
              v-slot="{ id }"
              label="Nro. de comprobante"
              hint="Opcional: ayuda a confirmarlo más rápido."
            >
              <input
                :id="id"
                v-model="form.reference"
                class="input"
                maxlength="60"
              />
            </FormField>
            <FormField
              id="aviso-destino"
              v-slot="{ id }"
              label="¿Para qué es tu aporte?"
            >
              <select :id="id" v-model="form.purpose" class="select">
                <option v-for="purpose in purposes" :key="purpose">
                  {{ purpose }}
                </option>
              </select>
            </FormField>
            <FormField
              id="aviso-contacto"
              v-slot="{ id }"
              label="Teléfono o correo"
              hint="Opcional: para agradecerte cuando lo confirmemos."
              class="notice__wide"
            >
              <input
                :id="id"
                v-model="form.contact"
                class="input"
                maxlength="120"
              />
            </FormField>
            <div class="notice__wide notice__captcha">
              <TurnstileWidget
                ref="turnstile"
                @verified="token = $event"
                @expired="token = null"
              />
              <p v-if="errors.captcha" class="notice__error">
                {{ errors.captcha }}
              </p>
            </div>
            <AppAlert v-if="failure" tone="error" class="notice__wide">
              {{ failure }}
            </AppAlert>
            <div class="notice__wide notice__actions">
              <AppButton
                type="submit"
                :loading="sending"
                loading-label="Enviando…"
              >
                Ya hice mi aporte
              </AppButton>
              <span class="card__hint">
                Nunca te pediremos claves ni datos de tu tarjeta.
              </span>
            </div>
          </form>
        </section>
      </div>

      <aside class="aside" aria-label="Nuestra meta y otras formas de ayudar">
        <section v-if="goal" class="card goal" aria-labelledby="titulo-meta">
          <span class="eyebrow">Nuestra meta</span>
          <h2 id="titulo-meta">{{ goal.title }}</h2>
          <p class="goal__note">
            Solo contamos los aportes que ya confirmamos con el banco.
          </p>
          <p class="goal__amount">{{ bs(goal.raisedBs) }}</p>
          <div
            class="goal__bar"
            role="progressbar"
            :aria-valuenow="progress"
            aria-valuemin="0"
            aria-valuemax="100"
            :aria-label="`${progress}% de la meta`"
          >
            <i :style="{ width: `${progress}%` }" />
          </div>
          <p class="goal__row">
            <span>{{ goal.percent }}% de {{ bs(goal.targetBs) }}</span>
            <span>
              {{ goal.confirmedCount }}
              {{
                goal.confirmedCount === 1
                  ? 'aporte confirmado'
                  : 'aportes confirmados'
              }}
            </span>
          </p>
          <ul v-if="goal.milestones.length" class="goal__milestones">
            <li v-for="milestone in goal.milestones" :key="milestone.label">
              <span>{{ milestone.label }}</span>
              <span :class="`is-${milestone.status}`">
                {{ MILESTONES[milestone.status] ?? milestone.status }}
              </span>
            </li>
          </ul>
        </section>
        <SkeletonBlock v-else-if="!goalLoaded" height="18rem" />

        <section class="card" aria-labelledby="titulo-estados">
          <h2 id="titulo-estados" class="card__title">
            Cómo sabrás el estado de tu aporte
          </h2>
          <ul class="states">
            <li>
              <StatusBadge tone="warning">Pendiente</StatusBadge>
              <span>Recibimos tu aviso y lo estamos verificando.</span>
            </li>
            <li>
              <StatusBadge tone="success">Confirmado</StatusBadge>
              <span
                >El ingreso ya está en nuestra cuenta y suma a la meta.</span
              >
            </li>
          </ul>
        </section>

        <section class="card in-kind" aria-labelledby="titulo-especie">
          <h2 id="titulo-especie" class="card__title">
            También puedes donar en especie
          </h2>
          <p>
            Colchonetas, pelotas de terapia, sillas o materiales de taller en
            buen estado. Escríbenos antes para saber qué necesitamos.
          </p>
          <SiteLink
            class="arrow-link"
            :to="{
              name: 'inicio',
              query: { motivo: 'especie' },
              hash: '#contacto',
            }"
          >
            Ofrecer una donación en especie →
          </SiteLink>
        </section>
      </aside>
    </div>

    <!-- En el celular, el paso que sigue siempre está a la vista -->
    <div v-if="!tracking && !route.query.aviso" class="sticky-cta">
      <AppButton block @click="toStep('paso-2')">
        Donar {{ chosenAmount ? bs(chosenAmount) : '' }} con QR
      </AppButton>
      <button type="button" class="inline-link" @click="toStep('paso-3')">
        Ya transferí: avisar de mi aporte
      </button>
    </div>
  </div>
</template>

<style scoped>
.support {
  --gutter: max(
    clamp(var(--space-4), 5.5vw, 5rem),
    calc((100% - 90rem) / 2 + 5rem)
  );
}

.support h2,
.support h3 {
  margin: 0;
}

.hero {
  display: grid;
  grid-template-columns: 1.05fr 0.95fr;
  align-items: center;
  gap: clamp(var(--space-8), 5vw, 4.5rem);
  padding: clamp(var(--space-8), 5vh, 4.5rem) var(--gutter)
    clamp(var(--space-8), 5vh, 4rem);
}

.hero h1 {
  margin: var(--space-4) 0 var(--space-5);
  font-size: clamp(2.3rem, 1rem + 3.2vw, 3.75rem);
  font-weight: 400;
  line-height: 1.08;
  color: var(--color-heading);
}

.hero h1 em {
  color: var(--aspar-guindo);
}

.hero__lead {
  max-width: 35rem;
  margin: 0;
  font-size: clamp(var(--text-md), 0.85rem + 0.55vw, 1.3rem);
  color: var(--color-text-muted);
}

.hero__facts {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3) var(--space-8);
  margin: var(--space-8) 0 0;
  padding: 0;
  list-style: none;
  color: var(--color-text-muted);
}

.hero__facts li {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.hero__facts i {
  display: grid;
  place-items: center;
  width: 1.85rem;
  height: 1.85rem;
  border-radius: 50%;
  background: var(--aspar-rosa);
  color: var(--aspar-guindo);
  font-style: normal;
  font-weight: 700;
  font-size: var(--text-sm);
}

.hero__photo {
  position: relative;
  margin: 0 1.4rem 1.4rem 0;
}

.hero__photo::before {
  content: '';
  position: absolute;
  inset: 1.6rem -1.4rem -1.4rem 1.6rem;
  border-radius: 22px 120px 22px 22px;
  background: var(--aspar-rosa);
}

.hero__photo img {
  position: relative;
  display: block;
  width: 100%;
  height: clamp(14rem, 40vh, 25rem);
  object-fit: cover;
  border-radius: 22px 120px 22px 22px;
}

.hero__stamp {
  position: absolute;
  left: -2rem;
  bottom: 2rem;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin: 0;
  padding: var(--space-4) var(--space-5);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  box-shadow: 0 10px 30px rgb(30 39 36 / 0.12);
}

.hero__stamp b {
  font-family: var(--font-serif);
  font-size: 1.75rem;
  font-weight: 500;
  line-height: 1;
  color: var(--aspar-guindo);
}

.hero__stamp span {
  font-size: var(--text-sm);
  line-height: 1.3;
  color: var(--color-text-muted);
}

.body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(18rem, 26rem);
  align-items: start;
  gap: var(--space-8);
  padding: 0 var(--gutter) clamp(var(--space-10), 6vw, 5rem);
}

.steps,
.aside {
  display: grid;
  gap: var(--space-6);
}

.card {
  padding: clamp(var(--space-5), 2.5vw, var(--space-8));
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-sm);
}

.card__hint {
  margin: var(--space-2) 0 0;
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.card__title {
  font-family: inherit;
  font-size: var(--text-xl);
  color: var(--color-heading);
}

.step {
  display: flex;
  align-items: baseline;
  gap: var(--space-3);
  font-family: inherit;
  font-size: var(--text-xl);
  color: var(--color-text);
}

.step span {
  font-family: var(--font-serif);
  font-size: 1.9rem;
  font-weight: 500;
  line-height: 1;
  color: var(--aspar-rojo);
}

/* Paso 1 */
.amounts {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-3);
  margin: var(--space-5) 0 var(--space-4);
}

.amounts button {
  min-height: 3.25rem;
  border: 1.5px solid var(--color-border-strong);
  border-radius: var(--radius-md);
  background: #fff;
  color: var(--color-text);
  font: inherit;
  font-size: var(--text-lg);
  font-weight: 600;
  cursor: pointer;
  transition:
    background-color var(--duration-fast) var(--ease-out),
    border-color var(--duration-fast) var(--ease-out);
}

.amounts button:hover {
  border-color: var(--aspar-guindo);
}

.amounts button.is-on {
  border-color: var(--aspar-guindo);
  background: var(--aspar-guindo);
  color: #fff;
}

.amounts button:focus-visible {
  box-shadow: var(--focus-ring);
}

.impact {
  margin: var(--space-4) 0 0;
  padding: var(--space-3) var(--space-4);
  border-left: 3px solid var(--aspar-rojo);
  border-radius: var(--radius-md);
  background: var(--crema-100);
  color: var(--color-text-muted);
}

.impact b {
  color: var(--aspar-guindo);
}

/* Paso 2 */
.qr {
  display: grid;
  grid-template-columns: 13rem 1fr;
  align-items: center;
  gap: var(--space-8);
  margin-top: var(--space-5);
}

.qr__code {
  display: grid;
  place-items: center;
  aspect-ratio: 1;
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: #fff;
}

.qr__code img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.qr__missing {
  margin: 0;
  padding: var(--space-4);
  text-align: center;
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.qr h3 {
  font-family: inherit;
  font-size: var(--text-lg);
}

.qr ol {
  margin: var(--space-3) 0 0;
  padding-left: var(--space-5);
  color: var(--color-text-muted);
}

.qr li {
  margin-bottom: var(--space-1);
}

.qr__account {
  margin: var(--space-3) 0;
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

/* Paso 3 */
.notice {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4) var(--space-5);
  margin-top: var(--space-5);
}

.notice__wide {
  grid-column: 1 / -1;
}

.notice__captcha {
  display: grid;
  gap: var(--space-2);
}

.notice__error {
  margin: 0;
  color: var(--color-danger);
  font-size: var(--text-sm);
}

.notice__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3) var(--space-5);
}

.notice__actions .card__hint {
  margin: 0;
}

/* Después de avisar */
.thanks {
  display: grid;
  gap: var(--space-6);
}

.thanks__head {
  display: flex;
  gap: var(--space-5);
  align-items: flex-start;
}

.thanks__head p {
  margin: var(--space-2) 0 0;
  color: var(--color-text-muted);
}

.thanks__head h2 {
  font-size: var(--text-3xl);
  font-weight: 400;
  color: var(--color-heading);
}

.thanks__seal {
  display: grid;
  flex: none;
  place-items: center;
  width: 3.5rem;
  height: 3.5rem;
  border-radius: 50%;
  background: var(--aspar-rosa);
  color: var(--aspar-guindo);
  font-size: 1.5rem;
}

.track {
  display: grid;
  gap: var(--space-4);
  margin: 0;
  padding: 0;
  list-style: none;
}

.track li {
  display: flex;
  gap: var(--space-4);
  align-items: flex-start;
}

.track b,
.track small {
  display: block;
}

.track small {
  color: var(--color-text-muted);
}

.track__dot {
  display: grid;
  flex: none;
  place-items: center;
  width: 2.25rem;
  height: 2.25rem;
  border: 2px solid var(--color-border-strong);
  border-radius: 50%;
  background: var(--color-surface);
  color: var(--color-text-muted);
  font-weight: 700;
}

.track .is-done .track__dot {
  border-color: var(--tone-success-fg);
  background: var(--tone-success-fg);
  color: #fff;
}

.track .is-now .track__dot {
  border-color: var(--aspar-guindo);
  color: var(--aspar-guindo);
  box-shadow: 0 0 0 4px var(--aspar-rosa);
}

.track .is-cancelled .track__dot {
  border-color: var(--color-text-muted);
  background: var(--tone-neutral-bg);
}

.track .is-todo b {
  color: var(--color-text-muted);
}

.thanks__status {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
  margin: 0;
}

.thanks__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}

/* Meta */
.goal {
  position: relative;
  overflow: hidden;
  border: 0;
  background: var(--aspar-verde);
  color: #eef3ef;
}

.goal .eyebrow {
  color: #f0b9b1;
}

.goal h2 {
  margin-top: var(--space-2);
  font-size: var(--text-2xl);
  font-weight: 400;
  line-height: 1.2;
  color: #fff;
}

.goal__note {
  margin: var(--space-2) 0 0;
  font-size: var(--text-sm);
  color: #c3d4cc;
}

.goal__amount {
  margin: var(--space-6) 0 0;
  font-family: var(--font-serif);
  font-size: 2.5rem;
  font-weight: 500;
  line-height: 1;
  color: #fff;
}

.goal__bar {
  overflow: hidden;
  height: 0.85rem;
  margin: var(--space-4) 0 var(--space-3);
  border-radius: var(--radius-pill);
  background: rgb(255 255 255 / 0.16);
}

.goal__bar i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #d94b42, #f08a7e);
}

.goal__row {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: var(--space-2);
  margin: 0;
  font-size: var(--text-sm);
  color: #c3d4cc;
}

.goal__milestones {
  display: grid;
  gap: var(--space-2);
  margin: var(--space-6) 0 0;
  padding: var(--space-4) 0 0;
  border-top: 1px solid rgb(255 255 255 / 0.14);
  list-style: none;
}

.goal__milestones li {
  display: flex;
  justify-content: space-between;
  gap: var(--space-3);
  color: #dfe9e3;
}

.goal__milestones .is-cubierto {
  color: #9fe0c4;
}

.states {
  display: grid;
  gap: var(--space-4);
  margin: var(--space-4) 0 0;
  padding: 0;
  list-style: none;
}

.states li {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: var(--space-3);
  align-items: start;
  color: var(--color-text-muted);
}

.in-kind {
  border-color: var(--rosa-200);
  background: var(--aspar-rosa);
}

.in-kind h2 {
  color: var(--guindo-900);
}

.in-kind p {
  margin: var(--space-3) 0 var(--space-4);
  color: var(--color-text-muted);
}

.arrow-link,
.inline-link {
  padding: 0;
  border: 0;
  background: none;
  color: var(--color-link);
  font: inherit;
  font-weight: 600;
  text-decoration: underline;
  text-decoration-thickness: 1.5px;
  text-underline-offset: 0.3em;
  cursor: pointer;
}

.sticky-cta,
.mini-goal {
  display: none;
}

.thanks {
  scroll-margin-top: 5rem;
}

@media (max-width: 1080px) {
  .body {
    grid-template-columns: 1fr;
  }

  .aside {
    grid-template-columns: repeat(auto-fit, minmax(17rem, 1fr));
  }
}

@media (max-width: 860px) {
  .hero {
    grid-template-columns: 1fr;
  }

  .hero__stamp {
    left: var(--space-3);
    bottom: var(--space-3);
  }

  .hero__photo img {
    height: clamp(12rem, 45vw, 20rem);
  }
}

/* Celular: un paso por pantalla y el botón para seguir siempre a la vista */
@media (max-width: 640px) {
  .support {
    padding-bottom: 7.5rem;
  }

  .hero {
    padding-top: var(--space-6);
  }

  .amounts {
    grid-template-columns: 1fr 1fr;
  }

  /* La meta, en corto, junto a los montos (la tarjeta completa va al final) */
  .mini-goal {
    display: grid;
    gap: var(--space-1);
    margin-top: var(--space-4);
    padding: var(--space-4);
    border-radius: var(--radius-md);
    background: var(--aspar-verde);
    color: #c3d4cc;
  }

  .mini-goal p {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin: 0;
    font-size: var(--text-sm);
  }

  .mini-goal b {
    font-family: var(--font-serif);
    font-size: var(--text-xl);
    font-weight: 500;
    color: #fff;
  }

  .mini-goal .goal__bar {
    margin: var(--space-2) 0;
  }

  .hero__facts {
    margin-top: var(--space-5);
  }

  .hero__photo img {
    height: 11rem;
  }

  .qr {
    grid-template-columns: 1fr;
    justify-items: center;
    gap: var(--space-5);
  }

  .qr__code {
    width: min(15rem, 100%);
  }

  .notice {
    grid-template-columns: 1fr;
  }

  .sticky-cta {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: var(--z-sticky);
    display: grid;
    gap: var(--space-2);
    justify-items: center;
    padding: var(--space-3) var(--space-4)
      calc(var(--space-3) + env(safe-area-inset-bottom));
    border-top: 1px solid var(--color-border);
    background: rgb(255 253 249 / 0.97);
    box-shadow: 0 -8px 24px rgb(30 39 36 / 0.08);
  }

  .sticky-cta :deep(.btn) {
    min-height: 3rem;
  }

  .sticky-cta .inline-link {
    font-size: var(--text-sm);
  }
}
</style>
