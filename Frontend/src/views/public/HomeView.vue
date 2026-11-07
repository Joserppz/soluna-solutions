<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import type {
  PublicAlbumSummary,
  PublicGoal,
  PublicSchedule,
} from '../../api/types'
import artPhoto from '../../assets/sitio/arte.webp'
import heroPhoto from '../../assets/sitio/encuentro-taller.webp'
import familiesPhoto from '../../assets/sitio/familias.webp'
import movementPhoto from '../../assets/sitio/movimiento.webp'
import AlbumDialog from '../../components/public/AlbumDialog.vue'
import InquiryForm from '../../components/public/InquiryForm.vue'
import ParticipateDialog from '../../components/public/ParticipateDialog.vue'
import SiteLink from '../../components/public/SiteLink.vue'
import AppAlert from '../../components/ui/AppAlert.vue'
import AppButton from '../../components/ui/AppButton.vue'
import AppModal from '../../components/ui/AppModal.vue'
import SkeletonBlock from '../../components/ui/SkeletonBlock.vue'
import StatusBadge from '../../components/ui/StatusBadge.vue'
import { useApi } from '../../composables/useApi'
import { useSiteContent } from '../../composables/useSiteContent'
import {
  clock,
  dayLabel,
  monthBounds,
  monthOf,
  monthTitle,
  shiftMonth,
  timeRange,
  today,
  weekdayShort,
} from '../../utils/ops'
import {
  AVAILABILITY,
  SITE_DEFAULTS,
  bs,
  canJoin,
  isContactKind,
  joinSteps,
  nextActivity,
  questions,
  splitTitle,
  text,
  type ContactKind,
} from '../../utils/site'

/**
 * Inicio del sitio público (diseño págs. 2 y 3): presentación, próximo encuentro, misión
 * y visión, agenda del mes, cómo participar, álbumes, formas de ayudar, contacto y
 * preguntas frecuentes. Todo sale de la API; los textos sin publicar usan el del diseño.
 */
const { api } = useApi()
const route = useRoute()
const { content, load } = useSiteContent()

const MONTHS_AHEAD = 6
const currentMonth = monthOf(today())

const upcoming = ref<PublicSchedule[] | null>(null)
const month = ref(currentMonth)
const monthActivities = ref<PublicSchedule[] | null>(null)
const agendaFailed = ref(false)
const albums = ref<PublicAlbumSummary[] | null>(null)
const goal = ref<PublicGoal | null>(null)

const joining = ref<PublicSchedule | null>(null)
const joinOpen = ref(false)
const openAlbum = ref<PublicAlbumSummary | null>(null)
const albumOpen = ref(false)
const historyOpen = ref(false)
const contactSent = ref<string | null>(null)
const contactKind = ref<ContactKind>('orientacion')

const heroTitle = computed(() =>
  splitTitle(
    text(content.value, 'presentacion', 'titulo', SITE_DEFAULTS.heroTitle),
  ),
)
const heroLead = computed(() =>
  text(content.value, 'presentacion', 'subtitulo', SITE_DEFAULTS.heroLead),
)
const aboutTitle = computed(() =>
  text(content.value, 'mision_vision', 'titulo', SITE_DEFAULTS.aboutTitle),
)
const aboutLead = computed(() =>
  text(content.value, 'presentacion', 'texto', SITE_DEFAULTS.aboutLead),
)
const mission = computed(() =>
  text(content.value, 'mision_vision', 'mision', SITE_DEFAULTS.mission),
)
const vision = computed(() =>
  text(content.value, 'mision_vision', 'vision', SITE_DEFAULTS.vision),
)
const history = computed(() =>
  text(content.value, 'historia', 'texto')
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean),
)
const historyTitle = computed(() =>
  text(content.value, 'historia', 'titulo', 'Nuestra historia'),
)
const joinTitle = computed(() =>
  text(content.value, 'como_participar', 'titulo', SITE_DEFAULTS.joinTitle),
)
const joinLead = computed(() =>
  text(content.value, 'como_participar', 'texto', SITE_DEFAULTS.joinLead),
)
const steps = computed(() => joinSteps(content.value))
const faq = computed(() => questions(content.value))
const faqTitle = computed(() =>
  text(content.value, 'preguntas_frecuentes', 'titulo', SITE_DEFAULTS.faqTitle),
)

const next = computed(() =>
  upcoming.value ? nextActivity(upcoming.value, today()) : null,
)
const canGoBack = computed(() => month.value > currentMonth)
const canGoForward = computed(
  () => month.value < shiftMonth(currentMonth, MONTHS_AHEAD),
)

async function loadMonth() {
  monthActivities.value = null
  agendaFailed.value = false
  const requested = month.value
  try {
    const list = await api.public.schedules(monthBounds(requested))
    if (requested !== month.value) return
    monthActivities.value = [...list].sort((a, b) =>
      (a.date + a.startTime).localeCompare(b.date + b.startTime),
    )
  } catch {
    if (requested === month.value) agendaFailed.value = true
  }
}

function changeMonth(by: number) {
  month.value = shiftMonth(month.value, by)
  void loadMonth()
}

function participate(activity: PublicSchedule) {
  joining.value = activity
  joinOpen.value = true
}

function showAlbum(album: PublicAlbumSummary) {
  openAlbum.value = album
  albumOpen.value = true
}

/** Si una imagen no carga, queda el fondo y no el ícono roto. */
function hideBroken(event: Event) {
  ;(event.target as HTMLElement).style.visibility = 'hidden'
}

function dayNumber(isoDay: string) {
  return isoDay.slice(8, 10)
}

watch(
  () => route.query.motivo,
  (motivo) => {
    if (isContactKind(motivo)) {
      contactKind.value = motivo
      contactSent.value = null
    }
  },
  { immediate: true },
)

onMounted(() => {
  void load()
  void loadMonth()
  api.public
    .schedules()
    .then((list) => (upcoming.value = list))
    .catch(() => (upcoming.value = []))
  api.public
    .albums()
    .then((list) => (albums.value = list))
    .catch(() => (albums.value = []))
  api.public
    .donationGoal()
    .then((value) => (goal.value = value))
    .catch(() => (goal.value = null))
})
</script>

<template>
  <div class="home">
    <section class="hero" aria-labelledby="titulo-inicio">
      <div class="hero__text">
        <span class="eyebrow">Un lugar para acompañarnos</span>
        <h1 id="titulo-inicio">
          {{ heroTitle.start }}<em>{{ heroTitle.end }}</em>
        </h1>
        <p class="hero__lead">{{ heroLead }}</p>
        <div class="hero__actions">
          <AppButton size="lg" :to="{ name: 'inicio', hash: '#actividades' }">
            Ver las actividades
          </AppButton>
          <AppButton
            size="lg"
            variant="secondary"
            :to="{ name: 'inicio', hash: '#contacto' }"
          >
            Hablar con el equipo
          </AppButton>
        </div>
      </div>
      <div class="hero__photo">
        <img
          :src="heroPhoto"
          alt="Un taller de arte en la sede de ASPAR"
          width="900"
          height="783"
        />
        <SiteLink
          v-if="next"
          class="hero__when"
          :to="{ name: 'inicio', hash: '#actividades' }"
          aria-label="Ver el próximo encuentro"
        >
          <span class="hero__day">
            <small>{{ weekdayShort(next.date).toUpperCase() }}</small>
            <b>{{ dayNumber(next.date) }}</b>
          </span>
          <span>
            <strong>{{ next.title }}</strong>
            <span class="text-muted">
              {{ clock(next.startTime) }} · {{ next.location }}
            </span>
          </span>
        </SiteLink>
      </div>
    </section>

    <nav class="paths" aria-label="¿Qué necesitas?">
      <div class="paths__inner">
        <SiteLink
          :to="{
            name: 'inicio',
            query: { motivo: 'orientacion' },
            hash: '#contacto',
          }"
        >
          <b>Necesito orientación <span aria-hidden="true">→</span></b>
          <span>Conversemos sobre cómo participar.</span>
        </SiteLink>
        <SiteLink :to="{ name: 'inicio', hash: '#actividades' }">
          <b>Quiero participar <span aria-hidden="true">→</span></b>
          <span>Encuentra una actividad para ti.</span>
        </SiteLink>
        <SiteLink :to="{ name: 'inicio', hash: '#ayudar' }">
          <b>Quiero ayudar <span aria-hidden="true">→</span></b>
          <span>Tu tiempo y tu apoyo suman.</span>
        </SiteLink>
      </div>
    </nav>

    <section id="nosotros" class="band about" aria-labelledby="titulo-nosotros">
      <div>
        <span class="eyebrow">Nosotros</span>
        <h2 id="titulo-nosotros">{{ aboutTitle }}</h2>
        <p class="lead">{{ aboutLead }}</p>
        <button
          v-if="history.length"
          type="button"
          class="arrow-link"
          @click="historyOpen = true"
        >
          Conoce nuestra historia →
        </button>
      </div>
      <div class="about__mv">
        <div>
          <h3>Nuestra misión</h3>
          <p>{{ mission }}</p>
        </div>
        <div>
          <h3>Nuestra visión</h3>
          <p>{{ vision }}</p>
        </div>
        <p class="small text-muted">
          Lo hacemos posible entre familias, profesionales, voluntariado y
          amigos de la asociación.
        </p>
      </div>
    </section>

    <section class="band shares" aria-labelledby="titulo-compartimos">
      <div class="band__head">
        <div>
          <span class="eyebrow">Lo que compartimos</span>
          <h2 id="titulo-compartimos">Distintas maneras de estar juntos.</h2>
        </div>
        <p class="text-muted">
          Actividades de apoyo y participación comunitaria. No reemplazan la
          atención ni el diagnóstico médico.
        </p>
      </div>
      <div class="mosaic">
        <article class="tile tile--big">
          <img
            :src="movementPhoto"
            alt="Un grupo hace ejercicios sentado en la sede"
            loading="lazy"
          />
          <span class="tag">Cada sábado</span>
          <h3>Movimiento y fisioterapia</h3>
          <p>
            Movimiento acompañado, con ejercicios adaptados al ritmo de cada
            persona.
          </p>
        </article>
        <div class="mosaic__stack">
          <article class="tile tile--row">
            <img :src="artPhoto" alt="Pintando en un taller" loading="lazy" />
            <div>
              <span class="tag">Taller</span>
              <h3>Arte y expresión</h3>
              <p>
                Arteterapia y teatro para crear, expresarnos y encontrarnos.
              </p>
            </div>
          </article>
          <article class="tile tile--row">
            <img
              :src="familiesPhoto"
              alt="Familias conversando alrededor de una mesa"
              loading="lazy"
            />
            <div>
              <span class="tag">Una vez al mes</span>
              <h3>Familias que acompañan</h3>
              <p>
                Conversaciones para compartir dudas, experiencias y formas de
                cuidar.
              </p>
            </div>
          </article>
          <SiteLink
            class="arrow-link"
            :to="{ name: 'inicio', hash: '#participar' }"
          >
            Cómo participar en una actividad →
          </SiteLink>
        </div>
      </div>
    </section>

    <section
      id="actividades"
      class="band agenda"
      aria-labelledby="titulo-agenda"
    >
      <div>
        <span class="eyebrow">Nuestro próximo encuentro</span>
        <h2 id="titulo-agenda">Un sábado para movernos y compartir.</h2>
        <SkeletonBlock v-if="upcoming === null" height="12rem" />
        <article v-else-if="next" class="next" aria-label="Próximo encuentro">
          <StatusBadge tone="danger" :dot="false">
            {{ dayLabel(next.date) }}
          </StatusBadge>
          <h3>{{ next.title }}</h3>
          <p class="text-muted">
            {{ timeRange(next.startTime, next.endTime) }} · {{ next.location }}
          </p>
          <p v-if="next.description" class="next__text">
            {{ next.description }}
          </p>
          <AppButton
            v-if="canJoin(next, today())"
            size="sm"
            @click="participate(next)"
          >
            Quiero participar
          </AppButton>
        </article>
        <p v-else class="next next--empty">
          Pronto publicaremos el próximo encuentro. Mientras tanto, puedes
          escribirnos y te contamos cómo participar.
        </p>
      </div>

      <div class="calendar">
        <div class="calendar__head">
          <h3 aria-live="polite">{{ monthTitle(month) }}</h3>
          <div class="calendar__nav">
            <button
              type="button"
              aria-label="Mes anterior"
              :disabled="!canGoBack"
              @click="changeMonth(-1)"
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="Mes siguiente"
              :disabled="!canGoForward"
              @click="changeMonth(1)"
            >
              ›
            </button>
          </div>
        </div>
        <div class="calendar__list">
          <AppAlert v-if="agendaFailed" tone="warning">
            No pudimos cargar la agenda. Inténtalo de nuevo en un momento.
          </AppAlert>
          <template v-else-if="monthActivities === null">
            <SkeletonBlock v-for="n in 3" :key="n" height="3.5rem" />
          </template>
          <p v-else-if="!monthActivities.length" class="calendar__empty">
            Todavía no hay actividades publicadas para este mes.
          </p>
          <ul v-else class="events" aria-label="Actividades del mes">
            <li
              v-for="activity in monthActivities"
              :key="activity.id"
              class="event"
              :class="{
                'is-cancelled': activity.status === 'cancelada',
                'is-past': activity.date < today(),
              }"
            >
              <span class="event__day">
                <b>{{ dayNumber(activity.date) }}</b>
                <small>{{ weekdayShort(activity.date).toUpperCase() }}</small>
              </span>
              <div class="event__body">
                <h4>{{ activity.title }}</h4>
                <p v-if="activity.status === 'cancelada'">
                  {{ activity.cancellationNote || 'Se reprogramará pronto.' }}
                </p>
                <p v-else>
                  {{ timeRange(activity.startTime, activity.endTime) }} ·
                  {{ activity.location }}
                </p>
              </div>
              <div class="event__side">
                <StatusBadge v-if="activity.status === 'cancelada'">
                  Cancelada
                </StatusBadge>
                <StatusBadge v-else-if="activity.date < today()">
                  Ya pasó
                </StatusBadge>
                <StatusBadge
                  v-else-if="
                    activity.availability && AVAILABILITY[activity.availability]
                  "
                  :tone="AVAILABILITY[activity.availability]!.tone"
                >
                  {{ AVAILABILITY[activity.availability]!.label }}
                </StatusBadge>
                <AppButton
                  v-if="canJoin(activity, today())"
                  size="sm"
                  variant="secondary"
                  :aria-label="`Quiero participar en ${activity.title}`"
                  @click="participate(activity)"
                >
                  Quiero participar
                </AppButton>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </section>

    <section
      id="participar"
      class="band join"
      aria-labelledby="titulo-participar"
    >
      <div>
        <span class="eyebrow">Cómo participar</span>
        <h2 id="titulo-participar">{{ joinTitle }}</h2>
        <p class="lead">{{ joinLead }}</p>
        <AppButton
          :to="{
            name: 'inicio',
            query: { motivo: 'orientacion' },
            hash: '#contacto',
          }"
        >
          Necesito orientación
        </AppButton>
        <p class="small text-muted">
          No envíes documentos médicos por el formulario.
        </p>
      </div>
      <ol class="steps">
        <li v-for="(step, index) in steps" :key="index">
          <b class="steps__n">{{ index + 1 }}</b>
          <div>
            <h3>{{ step.title }}</h3>
            <p v-if="step.text">{{ step.text }}</p>
          </div>
        </li>
      </ol>
    </section>

    <section
      id="comunidad"
      class="band moments"
      aria-labelledby="titulo-comunidad"
    >
      <div class="band__head">
        <div>
          <span class="eyebrow">Momentos de comunidad</span>
          <h2 id="titulo-comunidad">Lo que compartimos deja huella.</h2>
        </div>
      </div>
      <div v-if="albums === null" class="albums">
        <SkeletonBlock v-for="n in 3" :key="n" height="16rem" />
      </div>
      <p v-else-if="!albums.length" class="text-muted">
        Pronto compartiremos fotos de nuestros encuentros.
      </p>
      <ul v-else class="albums" aria-label="Álbumes publicados">
        <li v-for="album in albums.slice(0, 6)" :key="album.id">
          <button
            type="button"
            class="album"
            :aria-label="`Ver el álbum «${album.title}»`"
            @click="showAlbum(album)"
          >
            <span class="album__cover">
              <img
                v-if="album.coverUrl"
                :src="album.coverUrl"
                alt=""
                loading="lazy"
                @error="hideBroken"
              />
            </span>
            <span class="album__title">{{ album.title }}</span>
            <span class="album__meta">
              {{ album.assetCount }}
              {{ album.assetCount === 1 ? 'archivo' : 'archivos' }}
              <template v-if="album.description">
                · {{ album.description }}
              </template>
            </span>
          </button>
        </li>
      </ul>
      <p class="small text-muted">
        Solo publicamos imágenes de quienes nos dieron su permiso.
      </p>
    </section>

    <section id="ayudar" class="band help" aria-labelledby="titulo-ayudar">
      <div>
        <span class="eyebrow">Tu apoyo tiene lugar aquí</span>
        <h2 id="titulo-ayudar">Hay muchas formas de estar presente.</h2>
        <p class="lead">
          Queremos un espacio propio y equipos para la fisioterapia. Cada
          colaboración se conversa con el equipo.
        </p>
      </div>
      <ul class="ways">
        <li>
          <div>
            <h3>Tu tiempo</h3>
            <p>Acompaña actividades o comparte lo que sabes.</p>
          </div>
          <SiteLink
            :to="{
              name: 'inicio',
              query: { motivo: 'voluntariado' },
              hash: '#contacto',
            }"
          >
            Ser voluntario/a →
          </SiteLink>
        </li>
        <li>
          <div>
            <h3>Materiales y equipos</h3>
            <p>Colchonetas, pelotas de terapia o sillas en buen estado.</p>
          </div>
          <SiteLink
            :to="{
              name: 'inicio',
              query: { motivo: 'especie' },
              hash: '#contacto',
            }"
          >
            Donar en especie →
          </SiteLink>
        </li>
        <li>
          <div>
            <h3>Un aporte económico</h3>
            <p>
              Con QR bancario, desde la app de tu banco.
              <template v-if="goal">
                {{ bs(goal.raisedBs) }} reunidos de {{ bs(goal.targetBs) }}.
              </template>
            </p>
          </div>
          <SiteLink :to="{ name: 'inicio', hash: '#ayudar' }"
            >Hacer un aporte →</SiteLink
          >
        </li>
      </ul>
    </section>

    <section
      id="contacto"
      class="band contact"
      aria-labelledby="titulo-contacto"
    >
      <div>
        <span class="eyebrow">Estamos para escucharte</span>
        <h2 id="titulo-contacto">No tienes que saber por dónde empezar.</h2>
        <p class="lead">
          Déjanos un mensaje. Te llamaremos para orientarte sobre actividades,
          registro o formas de colaborar.
        </p>
        <p class="contact__note">
          Este formulario no atiende emergencias ni ofrece diagnósticos. Si
          necesitas atención urgente, acude a un servicio de salud.
        </p>
      </div>
      <div class="contact__card">
        <div v-if="contactSent" class="contact__sent" role="status">
          <h3>¡Gracias por escribirnos!</h3>
          <p>{{ contactSent }}</p>
          <AppButton variant="secondary" @click="contactSent = null">
            Enviar otro mensaje
          </AppButton>
        </div>
        <InquiryForm
          v-else
          :initial-kind="contactKind"
          @sent="contactSent = $event"
        />
      </div>
    </section>

    <section class="band faq" aria-labelledby="titulo-preguntas">
      <div>
        <span class="eyebrow">Dudas frecuentes</span>
        <h2 id="titulo-preguntas">{{ faqTitle }}</h2>
      </div>
      <div>
        <details
          v-for="(item, index) in faq"
          :key="item.pregunta"
          :open="index < 2"
        >
          <summary>{{ item.pregunta }}</summary>
          <p>{{ item.respuesta }}</p>
        </details>
      </div>
    </section>

    <ParticipateDialog v-model:open="joinOpen" :activity="joining" />
    <AlbumDialog v-model:open="albumOpen" :album="openAlbum" />
    <AppModal v-model:open="historyOpen" :title="historyTitle" size="lg">
      <div class="history">
        <p v-for="(paragraph, index) in history" :key="index">
          {{ paragraph }}
        </p>
      </div>
    </AppModal>
  </div>
</template>

<style scoped>
.home {
  /* El contenido se alinea con el encabezado: columna de 90rem centrada */
  --gutter: max(
    clamp(var(--space-4), 5.5vw, 5rem),
    calc((100% - 90rem) / 2 + 5rem)
  );
  --band-y: clamp(3rem, 7vw, 6rem);
  --h2: clamp(2rem, 1.3rem + 2vw, 2.9rem);
}

.home h2 {
  margin: var(--space-3) 0 var(--space-5);
  font-size: var(--h2);
  font-weight: 400;
  line-height: 1.12;
  color: var(--color-heading);
}

.home h3,
.home h4 {
  margin: 0;
}

.lead {
  margin: 0 0 var(--space-6);
  font-size: clamp(var(--text-md), 0.9rem + 0.4vw, var(--text-lg));
  color: var(--color-text-muted);
}

.small {
  font-size: var(--text-sm);
}

.band {
  padding: var(--band-y) var(--gutter);
  scroll-margin-top: 4.5rem;
}

.band > * {
  min-width: 0;
}

.band__head {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: flex-end;
  gap: var(--space-4) var(--space-10);
  margin-bottom: var(--space-8);
}

.band__head h2 {
  margin-bottom: 0;
}

.band__head > p {
  max-width: 26rem;
  margin: 0;
}

.arrow-link {
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

/* Portada: con la franja de caminos, entra en la primera vista */
.hero {
  display: grid;
  grid-template-columns: 1fr 1fr;
  align-items: center;
  gap: clamp(var(--space-8), 5vw, 4.5rem);
  padding: clamp(var(--space-8), 5vh, 4.5rem) var(--gutter)
    clamp(var(--space-10), 7vh, 5.5rem);
}

.hero h1 {
  margin: var(--space-4) 0 var(--space-5);
  font-size: clamp(2.6rem, 1rem + 4.2vw, 4.6rem);
  font-weight: 400;
  line-height: 1.06;
  letter-spacing: -0.01em;
  color: var(--color-heading);
}

.hero h1 em {
  color: var(--aspar-guindo);
}

.hero__lead {
  max-width: 34rem;
  margin: 0;
  font-size: clamp(var(--text-md), 0.85rem + 0.55vw, 1.3rem);
  color: var(--color-text-muted);
}

.hero__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  margin-top: var(--space-8);
}

.hero__photo {
  position: relative;
  margin: 0 1.5rem 1.5rem 0;
}

.hero__photo::before {
  content: '';
  position: absolute;
  inset: 1.75rem -1.5rem -1.5rem 1.75rem;
  border-radius: 26px 140px 26px 26px;
  background: var(--aspar-rosa);
}

.hero__photo img {
  position: relative;
  display: block;
  width: 100%;
  height: clamp(16rem, 52vh, 32rem);
  object-fit: cover;
  border-radius: 26px 140px 26px 26px;
}

.hero__when {
  position: absolute;
  left: -2.5rem;
  bottom: 2.5rem;
  display: flex;
  align-items: center;
  gap: var(--space-4);
  max-width: 19rem;
  padding: var(--space-4) var(--space-5);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  box-shadow: 0 12px 30px rgb(30 39 36 / 0.14);
  color: var(--color-text);
  text-decoration: none;
  line-height: 1.35;
}

.hero__when strong,
.hero__when > span:last-child > span {
  display: block;
}

.hero__day {
  display: grid;
  justify-items: center;
  padding-right: var(--space-4);
  border-right: 1px solid var(--color-border);
}

.hero__day small {
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--aspar-rojo);
}

.hero__day b {
  font-family: var(--font-serif);
  font-size: 2rem;
  font-weight: 500;
  line-height: 1;
  color: var(--aspar-guindo);
}

/* Los tres caminos */
.paths {
  /* Fuera de la columna, el verde sigue a la izquierda y el guindo a la derecha */
  background: linear-gradient(
    90deg,
    var(--aspar-verde) 50%,
    var(--aspar-guindo) 50%
  );
}

.paths__inner {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  max-width: 90rem;
  margin: 0 auto;
  background: var(--aspar-verde);
}

.paths a {
  --gutter: clamp(var(--space-4), 5.5vw, 5rem);
}

.paths a {
  display: grid;
  gap: var(--space-2);
  padding: clamp(var(--space-6), 3.5vh, 2.5rem) var(--gutter);
  border-right: 1px solid rgb(255 255 255 / 0.12);
  color: #fff;
  text-decoration: none;
}

.paths a:last-child {
  border: 0;
  background: var(--aspar-guindo);
}

.paths a:hover b span {
  transform: translateX(4px);
}

.paths a:focus-visible {
  box-shadow: inset var(--focus-ring-on-dark);
}

.paths b {
  display: flex;
  justify-content: space-between;
  font-family: var(--font-serif);
  font-size: clamp(1.25rem, 1rem + 0.8vw, 1.7rem);
  font-weight: 400;
}

.paths b span {
  transition: transform var(--duration-base) var(--ease-out);
}

.paths a > span {
  color: #c9d8d1;
}

.paths a:last-child > span {
  color: #f1cfc9;
}

/* Nosotros */
.about {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: clamp(var(--space-8), 6vw, 5.5rem);
}

.about__mv {
  display: grid;
  gap: var(--space-6);
  padding-left: var(--space-6);
  border-left: 3px solid var(--aspar-rojo);
}

.about__mv h3 {
  margin-bottom: var(--space-2);
  font-family: inherit;
  font-size: var(--text-lg);
  color: var(--aspar-guindo);
}

.about__mv p {
  margin: 0;
  color: var(--color-text-muted);
}

/* Lo que compartimos */
.shares,
.moments,
.faq {
  background: var(--color-surface);
}

.mosaic {
  display: grid;
  grid-template-columns: 1.25fr 1fr;
  gap: var(--space-6);
}

.mosaic__stack {
  display: grid;
  align-content: start;
  gap: var(--space-6);
}

.tile img {
  display: block;
  width: 100%;
  object-fit: cover;
  border-radius: var(--radius-lg);
  background: var(--color-surface-sunken);
}

.tile--big img {
  height: clamp(16rem, 34vw, 29rem);
  margin-bottom: var(--space-5);
}

.tile--row {
  display: grid;
  grid-template-columns: minmax(8rem, 13rem) 1fr;
  gap: var(--space-5);
  align-items: center;
}

.tile--row img {
  height: 10.5rem;
}

.tile h3 {
  margin: var(--space-1) 0 var(--space-2);
  font-size: clamp(1.3rem, 1.1rem + 0.5vw, 1.65rem);
  font-weight: 400;
  color: var(--color-heading);
}

.tile p {
  margin: 0;
  color: var(--color-text-muted);
}

.tag {
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: var(--aspar-rojo);
}

/* Agenda */
.agenda {
  display: grid;
  grid-template-columns: 0.9fr 1.1fr;
  gap: clamp(var(--space-8), 5vw, 4.5rem);
  background: var(--verde-50);
}

.next {
  display: grid;
  justify-items: start;
  gap: var(--space-2);
  margin: var(--space-2) 0 0;
  padding: var(--space-6);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
}

.next h3 {
  margin-top: var(--space-2);
  font-family: inherit;
  font-size: var(--text-xl);
}

.next p {
  margin: 0;
}

.next__text {
  margin-bottom: var(--space-3) !important;
}

.next--empty {
  color: var(--color-text-muted);
}

.calendar__head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-4);
}

.calendar__head h3 {
  font-size: clamp(1.35rem, 1.1rem + 0.6vw, 1.65rem);
  font-weight: 500;
  color: var(--color-heading);
}

.calendar__nav {
  display: flex;
  gap: var(--space-2);
}

.calendar__nav button {
  width: 2.75rem;
  height: 2.75rem;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-pill);
  background: var(--color-surface);
  color: var(--aspar-verde);
  font-size: var(--text-xl);
  line-height: 1;
  cursor: pointer;
}

.calendar__nav button:disabled {
  opacity: 0.4;
  cursor: default;
}

.calendar__list {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-6);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
}

.calendar__empty {
  margin: 0;
  padding: var(--space-6) 0;
  color: var(--color-text-muted);
}

.events {
  margin: 0;
  padding: 0;
  list-style: none;
}

.event {
  display: grid;
  grid-template-columns: 3.75rem 1fr auto;
  gap: var(--space-4);
  align-items: center;
  padding: var(--space-5) 0;
  border-bottom: 1px solid var(--color-border);
}

.event:last-child {
  border: 0;
}

.event__day b {
  display: block;
  font-family: var(--font-serif);
  font-size: 2rem;
  font-weight: 500;
  line-height: 1;
  color: var(--aspar-guindo);
}

.event__day small {
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--color-text-subtle);
}

.event__body h4 {
  font-size: var(--text-lg);
}

.event__body p {
  margin: var(--space-1) 0 0;
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.event__side {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  align-items: center;
  gap: var(--space-2);
}

.event.is-cancelled h4 {
  text-decoration: line-through;
  color: var(--color-text-muted);
}

.event.is-past {
  opacity: 0.6;
}

/* Cómo participar */
.join {
  display: grid;
  grid-template-columns: 0.8fr 1.2fr;
  gap: clamp(var(--space-8), 6vw, 5rem);
}

.join .small {
  margin-top: var(--space-3);
}

.steps {
  margin: 0;
  padding: 0;
  list-style: none;
}

.steps li {
  display: grid;
  grid-template-columns: 4rem 1fr;
  padding: var(--space-6) 0;
  border-top: 1px solid var(--color-border);
}

.steps__n {
  font-family: var(--font-serif);
  font-size: 2.3rem;
  font-weight: 500;
  line-height: 1;
  color: var(--aspar-rojo);
}

.steps h3 {
  margin-bottom: var(--space-1) !important;
  font-family: inherit;
  font-size: var(--text-xl);
}

.steps p {
  margin: 0;
  color: var(--color-text-muted);
}

/* Álbumes */
.albums {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
  gap: var(--space-5);
  margin: 0 0 var(--space-5);
  padding: 0;
  list-style: none;
}

.album {
  display: grid;
  gap: var(--space-1);
  width: 100%;
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.album__cover {
  display: block;
  overflow: hidden;
  aspect-ratio: 4 / 3;
  margin-bottom: var(--space-2);
  border-radius: var(--radius-lg);
  background: var(--color-surface-sunken);
}

.album__cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform var(--duration-slow) var(--ease-out);
}

.album:hover .album__cover img {
  transform: scale(1.03);
}

.album:focus-visible {
  border-radius: var(--radius-lg);
  box-shadow: var(--focus-ring);
}

.album__title {
  font-size: var(--text-lg);
  font-weight: 600;
}

.album__meta {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

/* Formas de ayudar */
.help {
  display: grid;
  grid-template-columns: 1fr 1.5fr;
  gap: clamp(var(--space-8), 6vw, 5rem);
  background: var(--aspar-guindo);
  color: #fff;
}

.help .eyebrow {
  color: #f3b9b0;
}

.help h2 {
  color: #fff !important;
}

.help .lead {
  color: #f2d9d4;
}

.ways {
  margin: 0;
  padding: 0;
  list-style: none;
}

.ways li {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: var(--space-3) var(--space-6);
  align-items: center;
  padding: var(--space-6) 0;
  border-bottom: 1px solid rgb(255 255 255 / 0.18);
}

.ways li:first-child {
  border-top: 1px solid rgb(255 255 255 / 0.18);
}

.ways h3 {
  color: #fff;
  font-size: clamp(1.3rem, 1.1rem + 0.5vw, 1.6rem);
  font-weight: 400;
}

.ways p {
  margin: var(--space-1) 0 0;
  color: #f2d9d4;
}

.ways a {
  border-bottom: 1.5px solid rgb(255 255 255 / 0.4);
  color: #fff;
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;
}

.ways a:focus-visible {
  box-shadow: var(--focus-ring-on-dark);
}

/* Contacto */
.contact {
  display: grid;
  grid-template-columns: 0.9fr 1.1fr;
  gap: clamp(var(--space-8), 6vw, 5rem);
}

.contact__note {
  margin: 0;
  padding: var(--space-4) var(--space-5);
  border-radius: var(--radius-md);
  background: var(--aspar-rosa);
  color: var(--guindo-900);
}

.contact__card {
  padding: clamp(var(--space-5), 3vw, var(--space-8));
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-sm);
}

.contact__sent {
  display: grid;
  justify-items: start;
  gap: var(--space-3);
}

.contact__sent h3 {
  font-size: var(--text-2xl);
  font-weight: 400;
  color: var(--color-heading);
}

.contact__sent p {
  margin: 0;
}

/* Preguntas */
.faq {
  display: grid;
  grid-template-columns: 0.9fr 1.1fr;
  gap: clamp(var(--space-8), 6vw, 5rem);
}

.faq details {
  padding: var(--space-5) 0;
  border-top: 1px solid var(--color-border);
}

.faq summary {
  display: flex;
  justify-content: space-between;
  gap: var(--space-4);
  font-size: var(--text-lg);
  font-weight: 600;
  list-style: none;
  cursor: pointer;
}

.faq summary::-webkit-details-marker {
  display: none;
}

.faq summary::after {
  content: '+';
  color: var(--aspar-rojo);
  font-size: 1.5rem;
  line-height: 1;
}

.faq details[open] summary::after {
  content: '–';
}

.faq details p {
  margin: var(--space-3) 0 0;
  color: var(--color-text-muted);
}

.history p {
  margin: 0 0 var(--space-4);
}

/* Tableta y celular: una columna */
@media (max-width: 960px) {
  .hero,
  .about,
  .agenda,
  .join,
  .help,
  .contact,
  .faq,
  .mosaic {
    grid-template-columns: 1fr;
  }

  .hero__photo {
    margin: 0 1rem 1rem 0;
  }

  .hero__photo img {
    height: clamp(13rem, 42vw, 22rem);
  }

  .hero__when {
    left: var(--space-3);
    bottom: var(--space-3);
  }

  .paths {
    background: var(--aspar-verde);
  }

  .paths__inner {
    grid-template-columns: 1fr;
  }

  .paths a {
    border-right: 0;
    border-bottom: 1px solid rgb(255 255 255 / 0.12);
  }
}

@media (max-width: 640px) {
  .hero {
    padding-top: var(--space-6);
  }

  .hero__actions :deep(.btn) {
    flex: 1 1 100%;
  }

  .tile--row {
    grid-template-columns: 7.5rem 1fr;
    gap: var(--space-4);
  }

  .tile--row img {
    height: 6.5rem;
  }

  .calendar__list {
    padding: var(--space-1) var(--space-4);
  }

  .event {
    grid-template-columns: 2.75rem 1fr;
    gap: var(--space-3);
  }

  .event__side {
    grid-column: 2;
    justify-content: flex-start;
  }

  /* En el celular se toca con el dedo: 44 px o más */
  .event__side :deep(.btn),
  .next :deep(.btn) {
    min-height: 2.75rem;
  }

  .ways li {
    grid-template-columns: 1fr;
  }
}
</style>
