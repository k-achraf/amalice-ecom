// ECharts option builders for the Meta Ads analytics page. One place for the chart "look":
//  - categorical colors in the fixed validated order (never cycled; a 9th series folds into "Other"),
//  - thin marks, 4px rounded data-ends on the baseline, 2px lines, recessive grid,
//  - a crosshair + tooltip on every plot, text always in ink tokens (never the series color).
// Charts never use two y-axes: different measures get separate charts.

type Opt = Record<string, any>

// Reference categorical order (light surface). The first three also validate for all-pairs forms
// (donut / scatter), so those cap at 4 slices and fold the rest into "Other".
export const PALETTE = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948']
export const OTHER_COLOR = '#9aa5a0'
// Entity colors, fixed across every chart of the page.
export const ENTITY_COLORS: Record<string, string> = {
  Men: PALETTE[0]!, Women: PALETTE[1]!, Unknown: OTHER_COLOR,
  Facebook: PALETTE[0]!, Instagram: PALETTE[1]!, 'Audience Network': PALETTE[2]!, Messenger: PALETTE[3]!,
  'Mobile app': PALETTE[0]!, 'Mobile web': PALETTE[1]!, Desktop: PALETTE[2]!
}
// Ordinal blue ramp for funnel stages (step 250 is the lightest that still clears 2:1 on white).
export const FUNNEL_RAMP = ['#86b6ef', '#6da7ec', '#5598e7', '#3987e5', '#2a78d6', '#1c5cab', '#184f95']
const PREVIOUS_COLOR = '#9aa5a0'
const INK = { text: '#0E2928', muted: '#4A6B60', grid: '#ECE8DD', axis: '#DCD6C6', surface: '#FFFFFF' }

export type ValueFormatter = (v: number | null | undefined) => string

const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 })
export const compactNumber = (v: number) => compact.format(v)

function base(extra: Opt = {}): Opt {
  return {
    animationDuration: 350,
    textStyle: { fontFamily: 'Outfit, system-ui, sans-serif', color: INK.muted },
    tooltip: {
      confine: true,
      backgroundColor: INK.surface,
      borderColor: INK.axis,
      borderWidth: 1,
      padding: [8, 10],
      textStyle: { color: INK.text, fontSize: 13 },
      extraCssText: 'box-shadow: 0 4px 16px rgba(14,41,40,.12); border-radius: 8px;'
    },
    ...extra
  }
}

const axisLabel = { color: INK.muted, fontSize: 12 }
const valueAxis = (fmt: ValueFormatter, extra: Opt = {}): Opt => ({
  type: 'value',
  axisLabel: { ...axisLabel, formatter: (v: number) => fmt(v) },
  splitLine: { lineStyle: { color: INK.grid } },
  axisLine: { show: false },
  axisTick: { show: false },
  ...extra
})
const categoryAxis = (data: string[], extra: Opt = {}): Opt => ({
  type: 'category',
  data,
  axisLabel: { ...axisLabel, hideOverlap: true },
  axisLine: { lineStyle: { color: INK.axis } },
  axisTick: { show: false },
  ...extra
})

const legendFor = (names: string[]): Opt => ({ show: names.length > 1, bottom: 0, icon: 'roundRect', itemWidth: 12, itemHeight: 6, textStyle: { color: INK.text, fontSize: 12 } })

function tooltipValue(fmt: ValueFormatter) {
  return (v: unknown) => (typeof v === 'number' ? fmt(v) : '—')
}

// ---- time series ----

export interface LineSeries { name: string; data: (number | null)[]; color?: string; dashed?: boolean; area?: boolean }

// One metric over time. `bars` draws columns instead of a line (counts); a dashed grey series is the previous period.
export function timeOption(opts: { dates: string[]; series: LineSeries[]; fmt: ValueFormatter; bars?: boolean; small?: boolean }): Opt {
  const { dates, series, fmt, bars, small } = opts
  return base({
    grid: { left: 8, right: 12, top: small ? 12 : 16, bottom: series.length > 1 ? 34 : 8, containLabel: true },
    legend: legendFor(series.map((s) => s.name)),
    tooltip: { ...base().tooltip, trigger: 'axis', axisPointer: { type: bars ? 'shadow' : 'line', lineStyle: { color: INK.axis, width: 1 } }, valueFormatter: tooltipValue(fmt) },
    xAxis: categoryAxis(dates, { boundaryGap: !!bars, axisLabel: { ...axisLabel, hideOverlap: true, formatter: (d: string) => d.slice(5) } }),
    yAxis: valueAxis(fmt, { axisLabel: { ...axisLabel, formatter: (v: number) => fmt(v) } }),
    series: series.map((s, i) => {
      const color = s.color ?? (i === 0 ? PALETTE[0] : PREVIOUS_COLOR)
      return bars
        ? { type: 'bar', name: s.name, data: s.data, barMaxWidth: 18, itemStyle: { color, borderRadius: [4, 4, 0, 0] }, emphasis: { focus: 'series' } }
        : {
            type: 'line',
            name: s.name,
            data: s.data,
            smooth: false,
            showSymbol: false,
            symbolSize: 8,
            connectNulls: false,
            lineStyle: { width: 2, color, type: s.dashed ? 'dashed' : 'solid' },
            itemStyle: { color, borderColor: INK.surface, borderWidth: 2 },
            areaStyle: s.area ? { color, opacity: 0.1 } : undefined,
            emphasis: { focus: 'series' }
          }
    })
  })
}

// ---- categories ----

// Vertical or horizontal columns of one measure per category (single series, one hue).
export function barOption(opts: { categories: string[]; values: (number | null)[]; fmt: ValueFormatter; name: string; horizontal?: boolean; color?: string }): Opt {
  const { categories, values, fmt, name, horizontal, color = PALETTE[0] } = opts
  const cat = horizontal ? { ...categoryAxis([...categories].reverse()), axisLabel: { ...axisLabel, width: 120, overflow: 'truncate' } } : categoryAxis(categories)
  const data = horizontal ? [...values].reverse() : values
  return base({
    grid: { left: 8, right: horizontal ? 56 : 12, top: 12, bottom: 8, containLabel: true },
    tooltip: { ...base().tooltip, trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: tooltipValue(fmt) },
    xAxis: horizontal ? valueAxis(fmt, { splitLine: { show: false }, axisLabel: { show: false } }) : cat,
    yAxis: horizontal ? cat : valueAxis(fmt),
    series: [{
      type: 'bar',
      name,
      data,
      barMaxWidth: horizontal ? 16 : 28,
      itemStyle: { color, borderRadius: horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0] },
      label: horizontal ? { show: true, position: 'right', color: INK.text, fontSize: 12, formatter: (p: { value: number | null }) => (p.value == null ? '' : fmt(p.value)) } : { show: false },
      emphasis: { itemStyle: { opacity: 0.85 } }
    }]
  })
}

// Several stacked series per category (≤ 4 in palette order); segments get a 2px surface gap.
export function stackedBarOption(opts: { categories: string[]; series: { name: string; data: number[]; color?: string }[]; fmt: ValueFormatter }): Opt {
  const { categories, series, fmt } = opts
  return base({
    grid: { left: 8, right: 12, top: 12, bottom: 34, containLabel: true },
    legend: legendFor(series.map((s) => s.name)),
    tooltip: { ...base().tooltip, trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: tooltipValue(fmt) },
    xAxis: categoryAxis(categories),
    yAxis: valueAxis(fmt),
    series: series.map((s, i) => ({
      type: 'bar',
      stack: 'total',
      name: s.name,
      data: s.data,
      barMaxWidth: 32,
      itemStyle: { color: s.color ?? PALETTE[i], borderColor: INK.surface, borderWidth: 1, borderRadius: i === series.length - 1 ? [4, 4, 0, 0] : 0 },
      emphasis: { focus: 'series' }
    }))
  })
}

// Share of a whole: top 4 slices, the rest folded into "Other"; the legend names each slice.
// `colors` pins a color to an entity name (so Men/Women or Facebook/Instagram keep their color in every chart).
export function donutOption(opts: { items: { name: string; value: number }[]; fmt: ValueFormatter; centerLabel?: string; colors?: Record<string, string> }): Opt {
  const sorted = [...opts.items].filter((i) => i.value > 0).sort((a, b) => b.value - a.value)
  const top = sorted.slice(0, 4)
  const rest = sorted.slice(4).reduce((s, i) => s + i.value, 0)
  const data = [...top.map((t, i) => ({ ...t, itemStyle: { color: opts.colors?.[t.name] ?? PALETTE[i] } })), ...(rest > 0 ? [{ name: 'Other', value: rest, itemStyle: { color: OTHER_COLOR } }] : [])]
  const total = data.reduce((s, d) => s + d.value, 0)
  return base({
    tooltip: {
      ...base().tooltip,
      trigger: 'item',
      formatter: (p: { name: string; value: number; percent: number }) => `${p.name}<br/><b>${opts.fmt(p.value)}</b> · ${p.percent.toFixed(1)}%`
    },
    legend: { bottom: 0, icon: 'roundRect', itemWidth: 12, itemHeight: 6, textStyle: { color: INK.text, fontSize: 12 } },
    title: opts.centerLabel ? { text: opts.fmt(total), subtext: opts.centerLabel, left: 'center', top: '34%', textStyle: { color: INK.text, fontSize: 18, fontWeight: 600 }, subtextStyle: { color: INK.muted, fontSize: 12 } } : undefined,
    series: [{
      type: 'pie',
      radius: ['52%', '76%'],
      center: ['50%', '44%'],
      avoidLabelOverlap: true,
      itemStyle: { borderColor: INK.surface, borderWidth: 2, borderRadius: 4 },
      label: { show: false },
      emphasis: { scaleSize: 4 },
      data
    }]
  })
}

// Stage-by-stage drop-off (ordinal, so one blue ramp light → dark).
export function funnelOption(steps: { name: string; value: number }[], fmt: ValueFormatter): Opt {
  const ramp = FUNNEL_RAMP.slice(0, steps.length)
  return base({
    tooltip: { ...base().tooltip, trigger: 'item', formatter: (p: { name: string; value: number }) => `${p.name}<br/><b>${fmt(p.value)}</b>` },
    series: [{
      type: 'funnel',
      left: '2%',
      width: '52%',
      top: 8,
      bottom: 8,
      sort: 'none',
      gap: 2,
      minSize: '8%',
      label: { show: true, position: 'right', color: INK.text, fontSize: 12, formatter: (p: { name: string; value: number }) => `${p.name} · ${compactNumber(p.value)}` },
      labelLine: { show: true, length: 16, lineStyle: { color: INK.axis, width: 1 } },
      itemStyle: { borderColor: INK.surface, borderWidth: 2 },
      data: steps.map((s, i) => ({ ...s, itemStyle: { color: ramp[i] } }))
    }]
  })
}

// Compare entities on two measures; bubble area = a third measure. Colors by name come from `color`.
export interface ScatterPoint { name: string; x: number; y: number; size: number }
export function scatterOption(opts: { points: ScatterPoint[]; xName: string; yName: string; sizeName: string; fx: ValueFormatter; fy: ValueFormatter; fs: ValueFormatter }): Opt {
  const { points, xName, yName, sizeName, fx, fy, fs } = opts
  const maxSize = Math.max(1, ...points.map((p) => p.size))
  return base({
    grid: { left: 8, right: 24, top: 20, bottom: 28, containLabel: true },
    tooltip: {
      ...base().tooltip,
      trigger: 'item',
      formatter: (p: { data: [number, number, number, string] }) => `<b>${p.data[3]}</b><br/>${xName}: ${fx(p.data[0])}<br/>${yName}: ${fy(p.data[1])}<br/>${sizeName}: ${fs(p.data[2])}`
    },
    xAxis: valueAxis(fx, { name: xName, nameLocation: 'middle', nameGap: 28, nameTextStyle: { color: INK.muted } }),
    yAxis: valueAxis(fy, { name: yName, nameTextStyle: { color: INK.muted, align: 'left' } }),
    series: [{
      type: 'scatter',
      data: points.map((p) => [p.x, p.y, p.size, p.name]),
      symbolSize: (v: number[]) => 14 + (Math.sqrt(v[2]! / maxSize) * 30),
      itemStyle: { color: PALETTE[0], opacity: 0.75, borderColor: INK.surface, borderWidth: 2 },
      emphasis: { itemStyle: { opacity: 1 } }
    }]
  })
}

// Calendar heat map of one daily measure (sequential: one blue ramp, light = little).
export function calendarOption(opts: { days: { date: string; value: number }[]; fmt: ValueFormatter; name: string }): Opt {
  const { days, fmt, name } = opts
  const max = Math.max(1, ...days.map((d) => d.value))
  const first = days[0]?.date
  const last = days[days.length - 1]?.date
  return base({
    tooltip: { ...base().tooltip, trigger: 'item', formatter: (p: { data: [string, number] }) => `${p.data[0]}<br/><b>${fmt(p.data[1])}</b> ${name.toLowerCase()}` },
    visualMap: { min: 0, max, show: false, inRange: { color: ['#cde2fb', '#86b6ef', '#3987e5', '#1c5cab', '#0d366b'] } },
    calendar: {
      top: 24,
      left: 28,
      right: 12,
      bottom: 8,
      range: [first, last],
      cellSize: ['auto', 18],
      itemStyle: { color: '#F3F0E8', borderColor: INK.surface, borderWidth: 2 },
      splitLine: { show: false },
      yearLabel: { show: false },
      dayLabel: { color: INK.muted, fontSize: 11, firstDay: 1 },
      monthLabel: { color: INK.muted, fontSize: 11 }
    },
    series: [{ type: 'heatmap', coordinateSystem: 'calendar', data: days.map((d) => [d.date, d.value]), itemStyle: { borderRadius: 3 } }]
  })
}

// ---- orders & money ----

// Order outcomes keep fixed colors: delivered = status "good", returned = "critical", pending = "warning",
// in progress = blue, cancelled = grey. Each is named in the legend / tooltip, never color alone.
export const ORDER_STATUS_COLORS = { delivered: '#0ca30c', returned: '#d03b3b', inProgress: '#2a78d6', pending: '#fab219', cancelled: '#9aa5a0' }
const POSITIVE = PALETTE[0]!
const NEGATIVE = '#e34948'

// Gains (blue) and losses (red) around a zero line — the diverging pair. Horizontal when there are many names.
export function gainLossOption(opts: { names: string[]; values: number[]; fmt: ValueFormatter; horizontal?: boolean; name: string }): Opt {
  const { names, values, fmt, horizontal, name } = opts
  const cat = horizontal ? { ...categoryAxis([...names].reverse()), axisLabel: { ...axisLabel, width: 130, overflow: 'truncate' }, axisLine: { lineStyle: { color: INK.text } } } : categoryAxis(names, { axisLine: { lineStyle: { color: INK.text } } })
  const data = (horizontal ? [...values].reverse() : values).map((v) => ({ value: v, itemStyle: { color: v >= 0 ? POSITIVE : NEGATIVE, borderRadius: horizontal ? (v >= 0 ? [0, 4, 4, 0] : [4, 0, 0, 4]) : (v >= 0 ? [4, 4, 0, 0] : [0, 0, 4, 4]) } }))
  return base({
    grid: { left: 8, right: horizontal ? 72 : 12, top: 16, bottom: 8, containLabel: true },
    tooltip: { ...base().tooltip, trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: tooltipValue(fmt) },
    xAxis: horizontal ? valueAxis(fmt, { splitLine: { lineStyle: { color: INK.grid } } }) : cat,
    yAxis: horizontal ? cat : valueAxis(fmt),
    series: [{
      type: 'bar',
      name,
      data,
      barMaxWidth: horizontal ? 16 : 36,
      label: { show: true, position: horizontal ? 'right' : 'top', color: INK.text, fontSize: 12, formatter: (p: { value: number }) => fmt(p.value) },
      emphasis: { itemStyle: { opacity: 0.85 } }
    }]
  })
}

// Orders per entity split by outcome (horizontal stacked bars, 2px gaps between segments).
export function statusBarOption(opts: { names: string[]; series: { name: string; data: number[]; color: string }[] }): Opt {
  const { names, series } = opts
  return base({
    grid: { left: 8, right: 16, top: 8, bottom: 34, containLabel: true },
    legend: legendFor(series.map((s) => s.name)),
    tooltip: { ...base().tooltip, trigger: 'axis', axisPointer: { type: 'shadow' } },
    xAxis: valueAxis((v) => String(v ?? ''), { minInterval: 1 }),
    yAxis: { ...categoryAxis([...names].reverse()), axisLabel: { ...axisLabel, width: 130, overflow: 'truncate' } },
    series: series.map((s) => ({
      type: 'bar',
      stack: 'orders',
      name: s.name,
      data: [...s.data].reverse(),
      barMaxWidth: 18,
      itemStyle: { color: s.color, borderColor: INK.surface, borderWidth: 1 },
      emphasis: { focus: 'series' }
    }))
  })
}
