<script setup lang="ts">
// Thin ECharts wrapper: loads the (modular) library on first use so the rest of the admin
// doesn't pay for it, resizes with its box, and disposes on unmount. The option is built by
// lib/meta-charts.ts; `label` is the accessible name of the plot (a table view exists beside it).
const props = withDefaults(defineProps<{ option: Record<string, any>; height?: number; label: string }>(), { height: 280 })

type EChartsInstance = { setOption: (o: unknown, notMerge?: boolean) => void; resize: () => void; dispose: () => void }

let echartsPromise: Promise<{ init: (el: HTMLElement) => EChartsInstance }> | null = null
function loadEcharts() {
  echartsPromise ??= (async () => {
    const [core, charts, components, renderers] = await Promise.all([import('echarts/core'), import('echarts/charts'), import('echarts/components'), import('echarts/renderers')])
    core.use([
      charts.LineChart, charts.BarChart, charts.PieChart, charts.FunnelChart, charts.ScatterChart, charts.HeatmapChart,
      components.GridComponent, components.TooltipComponent, components.LegendComponent, components.TitleComponent, components.VisualMapComponent, components.CalendarComponent,
      renderers.CanvasRenderer
    ])
    return core as unknown as { init: (el: HTMLElement) => EChartsInstance }
  })()
  return echartsPromise
}

const el = ref<HTMLElement>()
let chart: EChartsInstance | null = null
let observer: ResizeObserver | null = null

onMounted(async () => {
  const echarts = await loadEcharts()
  if (!el.value) return
  chart = echarts.init(el.value)
  chart.setOption(props.option, true)
  observer = new ResizeObserver(() => chart?.resize())
  observer.observe(el.value)
})
watch(() => props.option, (option) => chart?.setOption(option, true))
onBeforeUnmount(() => {
  observer?.disconnect()
  chart?.dispose()
  chart = null
})
</script>

<template>
  <div ref="el" role="img" :aria-label="label" :style="{ height: `${height}px`, width: '100%' }" />
</template>
