<script setup lang="ts">
// The "N selected" bar shown above a table: extra actions in the slot, a Delete
// button when the viewer may delete (SuperAdmin), and Clear.
defineProps<{ count: number; busy?: boolean; canDelete?: boolean }>()
const emit = defineEmits<{ delete: []; clear: [] }>()
</script>

<template>
  <div class="bulkbar" :class="{ on: count > 0 }" role="toolbar" aria-label="Bulk actions">
    <span class="grow">{{ count }} selected</span>
    <slot />
    <button v-if="canDelete" class="btn btn-danger" type="button" :disabled="busy" @click="emit('delete')"><AdsIcon name="i-lucide-trash-2" />Delete</button>
    <button class="btn" type="button" @click="emit('clear')">Clear</button>
  </div>
</template>
