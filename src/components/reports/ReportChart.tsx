'use client'
// src/components/reports/ReportChart.tsx
// Gráfico de área interactivo (ECharts) para los reportes: tooltip por eje,
// zoom/pan (dataZoom inside + slider), gradiente con el acento de marca. Lee los
// colores del tema en runtime (CSS vars) para respetar dark/light.
import React, { useMemo } from 'react'
import dynamic from 'next/dynamic'
import { useUiTheme } from '@/providers/UiThemeProvider'

// echarts toca el DOM/canvas → sin SSR. Tipamos las props que usamos porque
// dynamic() no las infiere del export de la librería.
interface EChartsProps {
  option: Record<string, unknown>
  style?: React.CSSProperties
  notMerge?: boolean
  lazyUpdate?: boolean
  opts?: Record<string, unknown>
  className?: string
}
const ReactECharts = dynamic(
  async () => {
    const mod = await import('echarts-for-react')
    return mod.default as unknown as React.ComponentType<EChartsProps>
  },
  { ssr: false }
)

interface ReportChartProps {
  labels: string[]
  values: number[]
  unit: string
  height?: number
}

function cssVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v || fallback
}

export const ReportChart: React.FC<ReportChartProps> = ({ labels, values, unit, height = 340 }) => {
  const { theme } = useUiTheme()

  const option = useMemo(() => {
    const primary = cssVar('--color-primary-500', '#6F8CC0')
    const text = cssVar('--color-text-muted', '#A1A1AA')
    const textStrong = cssVar('--color-text-strong', '#FAFAFA')
    const grid = cssVar('--color-border-default', 'rgba(255,255,255,0.08)')
    const surface = cssVar('--color-surface-raised', '#232327')

    return {
      animationDuration: 500,
      grid: { top: 34, right: 24, bottom: 28, left: 46 },
      tooltip: {
        trigger: 'axis',
        backgroundColor: surface,
        borderWidth: 0,
        extraCssText: 'border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.35)',
        textStyle: { color: textStrong, fontSize: 12 },
        padding: [8, 12],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        formatter: (ps: any) => {
          const p = Array.isArray(ps) ? ps[0] : ps
          return `<div style="font-size:11px;opacity:.65;margin-bottom:3px">${p.axisValue}</div><span style="font-size:15px;font-weight:700">${p.data}</span> <span style="opacity:.7">${unit}</span>`
        },
      },
      xAxis: {
        type: 'category',
        data: labels,
        boundaryGap: true,
        axisLine: { lineStyle: { color: grid } },
        axisTick: { show: false },
        axisLabel: { color: text, fontSize: 11, hideOverlap: true },
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: grid } },
        axisLabel: { color: text, fontSize: 11 },
      },
      series: [
        {
          type: 'bar',
          data: values,
          barMaxWidth: 34,
          z: 1,
          // Barras redondeadas arriba, SIN borde, con gradiente vertical del acento
          // (sólido arriba → transparente abajo), igual que tenía el área lineal.
          itemStyle: {
            borderWidth: 0,
            borderRadius: [6, 6, 0, 0],
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: primary },
                { offset: 1, color: primary + '1F' },
              ],
            },
          },
          emphasis: {
            itemStyle: {
              color: {
                type: 'linear',
                x: 0, y: 0, x2: 0, y2: 1,
                colorStops: [
                  { offset: 0, color: primary },
                  { offset: 1, color: primary + '4D' },
                ],
              },
            },
          },
        },
        {
          // Línea de evolución (mismo valor que las barras) + etiquetas con el valor
          // de cada mes arriba. Va en un color neutro fuerte para contrastar con el
          // azul de las barras en ambos temas. No aparece en el tooltip (dato repetido).
          type: 'line',
          data: values,
          smooth: true,
          showSymbol: false,
          symbol: 'circle',
          symbolSize: 6,
          z: 3,
          lineStyle: { color: textStrong, width: 2 },
          itemStyle: { color: textStrong },
          tooltip: { show: false },
          emphasis: { focus: 'none', scale: false },
          label: {
            show: true,
            position: 'top',
            distance: 8,
            color: textStrong,
            fontSize: 11,
            fontWeight: 600,
            formatter: (p: { value: number }) =>
              p.value.toLocaleString(undefined, { maximumFractionDigits: 1 }),
          },
        },
      ],
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labels, values, unit, theme])

  return (
    <ReactECharts
      option={option}
      style={{ height, width: '100%' }}
      notMerge
      lazyUpdate
      opts={{ renderer: 'canvas' }}
    />
  )
}
