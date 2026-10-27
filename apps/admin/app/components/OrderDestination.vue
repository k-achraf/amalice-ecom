<script setup lang="ts">
// One cell for where an order goes: wilaya, commune and home/desk delivery.
// Shared by every order table so they read the same.
defineProps<{
  address: { region: string; city: string }
  shippingType: 'Home' | 'Desk' | null
}>()
const typeLabel = { Home: 'Home delivery', Desk: 'Stop desk' } as const
</script>

<template>
  <div style="line-height: 1.35">
    <div>{{ address.region || '—' }}<span v-if="address.city" class="muted"> · {{ address.city }}</span></div>
    <span v-if="shippingType" class="sub">{{ typeLabel[shippingType] }}</span>
  </div>
</template>
