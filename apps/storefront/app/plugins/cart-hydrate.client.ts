import { useCartStore } from '../stores/cart'

export default defineNuxtPlugin(() => {
  useCartStore().hydrate()
})
