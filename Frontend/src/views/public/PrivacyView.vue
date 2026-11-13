<script setup lang="ts">
import { computed } from 'vue'

import SiteLink from '../../components/public/SiteLink.vue'
import { useSiteContent } from '../../composables/useSiteContent'
import { contactLines } from '../../utils/site'

/**
 * Cómo cuida ASPAR los datos personales. Explica en palabras simples lo que el sistema
 * ya hace (RNF-06, ADR-005 y ADR-007): no promete nada que el código no cumpla.
 */
const { content } = useSiteContent()
const email = computed(() =>
  contactLines(content.value).find((line) => line.label === 'Correo'),
)

interface PrivacySection {
  id: string
  title: string
  /** `lead` va en negrita al inicio de la línea. */
  items: { lead?: string; text: string }[]
}

const sections: PrivacySection[] = [
  {
    id: 'que-guardamos',
    title: 'Qué datos guardamos',
    items: [
      {
        lead: 'Si nos escribes desde el sitio:',
        text: 'para pedir información, ser voluntario/a o donar en especie, guardamos tu nombre, tu teléfono, el motivo y tu mensaje.',
      },
      {
        lead: 'Si avisas de un aporte:',
        text: 'el monto, el número de comprobante y, solo si quieres, tu nombre y un teléfono o correo. Puedes donar sin dar tu nombre.',
      },
      {
        lead: 'Si eres parte de la comunidad:',
        text: 'la ficha que llena el equipo contigo o con tu familia (datos de contacto, familiares, asistencia y, cuando corresponde, información de salud y documentos).',
      },
      {
        lead: 'Si eres del equipo:',
        text: 'tu nombre, tu correo y tu rol para entrar al espacio del equipo.',
      },
    ],
  },
  {
    id: 'para-que',
    title: 'Para qué los usamos',
    items: [
      {
        text: 'Para responderte y acompañarte: llamarte, invitarte a los encuentros de los sábados y avisarte de cambios.',
      },
      { text: 'Para confirmar los aportes y agradecerte.' },
      {
        text: 'Para que el equipo conozca a cada persona y la acompañe mejor.',
      },
      {
        text: 'Nunca vendemos ni regalamos tus datos, y no los usamos para publicidad.',
      },
    ],
  },
  {
    id: 'quien-los-ve',
    title: 'Quién puede verlos',
    items: [
      {
        text: 'Solo las personas del equipo de ASPAR que los necesitan para su tarea. Cada rol ve únicamente lo suyo.',
      },
      {
        text: 'La información de salud y los documentos solo los abren los roles autorizados. Los documentos se entregan con un enlace que vence en 5 minutos.',
      },
      {
        text: 'Cada vez que alguien abre o cambia información sensible, queda anotado en un registro que revisa la administración.',
      },
    ],
  },
  {
    id: 'fotos',
    title: 'Fotos y videos',
    items: [
      {
        text: 'Solo publicamos fotos de personas que dieron su permiso de imagen. Si apareces en una foto y quieres que la quitemos, escríbenos y lo hacemos.',
      },
    ],
  },
  {
    id: 'seguridad',
    title: 'Cómo los protegemos',
    items: [
      {
        text: 'Toda la información viaja cifrada (HTTPS) y se guarda en servidores que solo el sistema de ASPAR puede consultar.',
      },
      {
        text: 'Los formularios usan una verificación de Cloudflare para frenar envíos automáticos.',
      },
      {
        text: 'El sitio no usa cookies de publicidad ni de seguimiento. Solo el espacio del equipo usa una cookie para mantener la sesión abierta.',
      },
    ],
  },
  {
    id: 'tus-derechos',
    title: 'Tus derechos',
    items: [
      {
        text: 'Puedes pedirnos ver, corregir o borrar tus datos, o dejar de recibir llamadas. Te respondemos lo antes posible.',
      },
    ],
  },
]
</script>

<template>
  <article class="privacy">
    <header class="privacy__head">
      <span class="eyebrow">Privacidad</span>
      <h1>Cómo cuidamos <em>tus datos.</em></h1>
      <p class="privacy__lead">
        En ASPAR acompañamos a personas con Parkinson y a sus familias. Para
        hacerlo pedimos algunos datos, y los cuidamos como cuidamos a las
        personas: con respeto.
      </p>
    </header>

    <div class="privacy__body">
      <nav class="privacy__index" aria-label="En esta página">
        <ol>
          <li v-for="section in sections" :key="section.id">
            <a :href="`#${section.id}`">{{ section.title }}</a>
          </li>
        </ol>
      </nav>

      <div class="privacy__sections">
        <section
          v-for="section in sections"
          :id="section.id"
          :key="section.id"
          class="privacy__section"
        >
          <h2>{{ section.title }}</h2>
          <ul>
            <li v-for="item in section.items" :key="item.text">
              <b v-if="item.lead">{{ item.lead }}</b> {{ item.text }}
            </li>
          </ul>
        </section>

        <section class="privacy__contact" aria-labelledby="privacidad-contacto">
          <h2 id="privacidad-contacto">¿Dudas o pedidos sobre tus datos?</h2>
          <p>
            Escríbenos
            <template v-if="email">
              a <a :href="email.href">{{ email.value }}</a>
            </template>
            o déjanos tu mensaje en el
            <SiteLink :to="{ name: 'inicio', hash: '#contacto' }">
              formulario de contacto</SiteLink
            >.
          </p>
        </section>

        <p class="privacy__updated">Última actualización: noviembre de 2026.</p>
      </div>
    </div>
  </article>
</template>

<style scoped>
.privacy {
  --gutter: max(
    clamp(var(--space-4), 5.5vw, 5rem),
    calc((100% - 72rem) / 2 + 2rem)
  );
  padding: clamp(var(--space-8), 6vh, 4.5rem) var(--gutter)
    clamp(var(--space-12), 8vh, 6rem);
}

.privacy__head {
  max-width: 46rem;
}

.privacy h1 {
  margin: var(--space-4) 0 var(--space-5);
  font-size: clamp(2.2rem, 1rem + 3vw, 3.4rem);
  font-weight: 400;
  line-height: 1.08;
  color: var(--color-heading);
}

.privacy h1 em {
  color: var(--aspar-guindo);
}

.privacy__lead {
  margin: 0;
  font-size: clamp(var(--text-md), 0.85rem + 0.5vw, 1.25rem);
  color: var(--color-text-muted);
}

.privacy__body {
  display: grid;
  grid-template-columns: 15rem minmax(0, 1fr);
  align-items: start;
  gap: clamp(var(--space-8), 5vw, 4rem);
  margin-top: clamp(var(--space-8), 6vh, 3.5rem);
}

.privacy__index {
  position: sticky;
  top: var(--space-8);
  padding: var(--space-5);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  box-shadow: var(--shadow-sm);
}

.privacy__index ol {
  display: grid;
  gap: var(--space-2);
  margin: 0;
  padding-left: var(--space-5);
  color: var(--color-text-muted);
}

.privacy__index a {
  color: var(--color-text);
  text-decoration: none;
}

.privacy__index a:hover {
  color: var(--color-link);
  text-decoration: underline;
}

.privacy__sections {
  display: grid;
  gap: var(--space-8);
  max-width: 46rem;
}

.privacy__section {
  scroll-margin-top: var(--space-8);
}

.privacy h2 {
  margin: 0 0 var(--space-3);
  font-size: var(--text-2xl);
}

.privacy__section ul {
  display: grid;
  gap: var(--space-3);
  margin: 0;
  padding-left: var(--space-5);
}

.privacy__section li::marker {
  color: var(--aspar-guindo);
}

.privacy__contact {
  padding: var(--space-6);
  border-radius: var(--radius-md);
  background: var(--rosa-100);
}

.privacy__contact p {
  margin: 0;
}

.privacy__updated {
  margin: 0;
  color: var(--color-text-subtle);
  font-size: var(--text-sm);
}

@media (max-width: 800px) {
  .privacy__body {
    grid-template-columns: minmax(0, 1fr);
  }

  .privacy__index {
    position: static;
  }
}
</style>
