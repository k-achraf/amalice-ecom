<script setup lang="ts">
import { CustomerSchema } from '@amalice/shared'

// Shared by both apps — storefront has no layout (no-op there), but admin
// now has a dashboard sidebar layout that would otherwise wrap this
// reference page too. Opt out explicitly so it renders standalone in both.
definePageMeta({ layout: false })

// Proves the same schema apps/api uses server-side (see OrdersController's
// CreateOrderDto) also runs unmodified in the browser via Vite — this is
// deliberately not a real checkout form (that's SF-05/SF-06), just the
// cross-app validation wiring.
const phoneInput = ref('')
const phoneResult = computed(() => CustomerSchema.shape.phone.safeParse(phoneInput.value))

const stops = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const
const colorGroups = [
  { name: 'brand', label: 'Primary — Polaris near-black (neutral ramp, #1A1A1A at 900)' },
  { name: 'ink', label: 'Secondary — teal-ink (admin-only via DS-09)' },
  { name: 'success', label: 'Success' },
  { name: 'warning', label: 'Warning (DS-01 gold, unchanged)' },
  { name: 'error', label: 'Error' },
  { name: 'info', label: 'Info' }
]

// Polaris elevation tokens — flat-but-layered, single neutral alpha base.
const shadows = [100, 200, 300, 400, 500] as const

const typeScale = [
  ['xs', 'text-xs'],
  ['sm', 'text-sm'],
  ['base', 'text-base'],
  ['lg', 'text-lg'],
  ['xl', 'text-xl'],
  ['2xl', 'text-2xl'],
  ['3xl', 'text-3xl'],
  ['4xl', 'text-4xl']
] as const

// `import.meta.dev` is module-only syntax — compile it to a plain boolean
// here so the template can reference it as an ordinary identifier.
const isDev = import.meta.dev

const colorMode = useColorMode()

const orderStates = [
  'PendingCallCenter', 'Cancelled', 'Confirmed', 'Packed', 'HandedToCourier',
  'OutForDelivery', 'DeliveryFailed', 'Delivered', 'ReturnedToOrigin',
  'Restocked', 'CashCollected', 'Reconciled', 'Settled'
] as const

useHead({ title: 'Style guide' })
</script>

<template>
  <main v-if="isDev" class="mx-auto max-w-4xl space-y-12 p-8">
    <header class="flex items-start justify-between gap-4">
      <div>
        <h1 class="text-3xl font-semibold">Style guide</h1>
        <p class="text-neutral-500">Dev-only reference for the shared design system — not shipped to production.</p>
      </div>
      <UButton
        :icon="colorMode.value === 'dark' ? 'i-lucide-sun' : 'i-lucide-moon'"
        color="neutral"
        variant="outline"
        @click="colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'"
      >
        {{ colorMode.value === 'dark' ? 'Light' : 'Dark' }} mode
      </UButton>
    </header>

    <section class="space-y-4">
      <h2 class="text-xl font-semibold">Color scales</h2>
      <div v-for="group in colorGroups" :key="group.name" class="space-y-1">
        <p class="text-sm font-medium">{{ group.label }} (<code>{{ group.name }}</code>)</p>
        <div class="flex overflow-hidden rounded-md border border-default">
          <div
            v-for="stop in stops"
            :key="stop"
            class="h-14 flex-1"
            :style="{ background: `var(--color-${group.name}-${stop})` }"
          />
        </div>
        <!-- Labels sit below the strip, on the page background, rather than
             overlaid on the swatch — a mid-lightness color (e.g. the 500
             stop on brand/success/warning) has no single flat text color
             that clears 4.5:1 against it, so overlaid labels are a contrast
             trap regardless of which text color is picked. -->
        <div class="flex text-center text-[10px] text-neutral-500">
          <span v-for="stop in stops" :key="stop" class="flex-1">{{ stop }}</span>
        </div>
      </div>
    </section>

    <section class="space-y-3">
      <h2 class="text-xl font-semibold">Type scale</h2>
      <p v-for="[name, cls] in typeScale" :key="name" :class="cls">
        {{ name }} — The quick brown fox ships COD orders
      </p>
    </section>

    <section class="space-y-2">
      <h2 class="text-xl font-semibold">Tabular figures</h2>
      <p class="tabular text-lg">Order #10294 — $1,204.50</p>
      <p class="tabular text-lg">Order #38821 — $   84.00</p>
    </section>

    <section class="space-y-3">
      <h2 class="text-xl font-semibold">StatusBadge — order lifecycle</h2>
      <p class="text-sm text-neutral-500">
        Every state from the order lifecycle (plan §7). <code>warning</code> vs <code>primary</code> checked here in a
        real badge context per DS-01's acceptance criteria, not just as flat swatches.
      </p>
      <div class="flex flex-wrap gap-2">
        <StatusBadge v-for="state in orderStates" :key="state" :state="state" />
      </div>
      <div class="flex items-center gap-2 rounded-md border border-default p-3">
        <span class="text-sm text-neutral-500">Primary brand color for comparison:</span>
        <UBadge color="primary" variant="subtle">Polaris near-black primary</UBadge>
      </div>
    </section>

    <section class="space-y-3">
      <h2 class="text-xl font-semibold">Elevation — Polaris shadows</h2>
      <p class="text-sm text-neutral-500">
        Single neutral alpha base (rgba(26,26,26,*)), low opacity — the flat-but-layered Polaris signature.
      </p>
      <div class="flex flex-wrap gap-6">
        <div
          v-for="level in shadows"
          :key="level"
          class="flex h-20 w-32 items-end rounded-md bg-default p-2"
          :style="{ boxShadow: `var(--shadow-polaris-${level})` }"
        >
          <span class="tabular text-xs text-neutral-500">{{ level }}</span>
        </div>
      </div>
    </section>

    <section class="space-y-3">
      <h2 class="text-xl font-semibold">PriceDisplay</h2>
      <div class="flex flex-wrap gap-4 tabular">
        <PriceDisplay :amount-cents="120450" />
        <PriceDisplay :amount-cents="8400" />
        <PriceDisplay :amount-cents="99" />
      </div>
    </section>

    <section class="space-y-3">
      <h2 class="text-xl font-semibold">EmptyState</h2>
      <div class="rounded-md border border-default">
        <EmptyState
          icon="i-lucide-package-search"
          title="No orders yet"
          description="Orders placed on the storefront will show up here."
        />
      </div>
    </section>

    <section class="space-y-3">
      <h2 class="text-xl font-semibold">Shared schema validation (@amalice/shared)</h2>
      <p class="text-sm text-neutral-500">
        <code>CustomerSchema.shape.phone</code> validated live here in the browser — the exact same schema
        <code>apps/api</code>'s <code>OrdersController</code> uses server-side for <code>CreateOrderDto</code>. One
        definition, not two hand-synced copies.
      </p>
      <UInput v-model="phoneInput" placeholder="+15555555555" class="max-w-xs" />
      <p v-if="phoneInput" class="text-sm" :class="phoneResult.success ? 'text-success' : 'text-error'">
        {{ phoneResult.success ? 'Valid E.164 phone number' : phoneResult.error.issues[0]?.message }}
      </p>
    </section>
  </main>
</template>
