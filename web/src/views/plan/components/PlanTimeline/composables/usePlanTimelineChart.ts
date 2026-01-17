import { computed, shallowRef, watch, type Ref, type ShallowRef } from 'vue';
import {
  echarts,
  type CustomRenderItem,
  type ECOption,
  type RenderItemAPI,
  type RenderItemParams,
  type RenderItemReturn,
} from '@/views/statistics/StatisticsChart/composables/chart/types';
import { useChartLifecycle } from '@/views/statistics/StatisticsChart/composables/chart/lifecycle';
import type { TimelineBar } from '../types';
import {
  BAR_BORDER_RADIUS,
  BAR_HEIGHT,
  BAR_PADDING_HORIZONTAL,
  BAR_PADDING_TOP,
  COLOR_BAR_TEXT,
  COLOR_BORDER,
  COLOR_EATING,
  COLOR_FASTING,
  COLOR_TEXT,
  DAY_LABEL_WIDTH_DESKTOP,
  DAY_LABEL_WIDTH_MOBILE,
  GRID_BORDER_RADIUS,
  HEADER_HEIGHT,
  MOBILE_BREAKPOINT,
  ROW_HEIGHT,
} from './chart/constants';

interface UsePlanTimelineChartOptions {
  numRows: Ref<number>;
  dayLabels: Ref<string[]>;
  hourLabels: Ref<string[]>;
  hourPositions: Ref<number[]>;
  timelineBars: Ref<TimelineBar[]>;
}

function getDayLabelWidth(chartWidth: number): number {
  return chartWidth < MOBILE_BREAKPOINT ? DAY_LABEL_WIDTH_MOBILE : DAY_LABEL_WIDTH_DESKTOP;
}

export function usePlanTimelineChart(
  chartContainer: Ref<HTMLElement | null>,
  options: UsePlanTimelineChartOptions,
) {
  const chartInstance: ShallowRef<echarts.ECharts | null> = shallowRef(null);

  // Parse day labels for direct access in renderItem
  const parsedDayLabels = computed(() => {
    return options.dayLabels.value.map((label) => {
      const parts = label.split('\n');
      return { dayName: parts[0], dayNum: parts[1] };
    });
  });

  // Transform hour labels to chart data format
  const hourLabelsData = computed(() => {
    return options.hourLabels.value.map((_, i) => ({
      value: [i],
    }));
  });

  // Transform timeline bars to chart data format
  const timelineBarsData = computed(() => {
    return options.timelineBars.value.map((bar, i) => ({
      value: [
        bar.dayIndex,
        bar.startHour,
        bar.endHour,
        i, // index to look up bar data
      ],
    }));
  });

  // Render function for hour labels header
  function renderHourLabels(params: RenderItemParams, api: RenderItemAPI): RenderItemReturn {
    const index = api.value(0) as number;
    const hourLabel = options.hourLabels.value[index];
    const hourPosition = options.hourPositions.value[index];
    if (hourLabel === undefined || hourPosition === undefined) return { type: 'group', children: [] };

    const chartWidth = params.coordSys.width;
    const dayLabelWidth = getDayLabelWidth(chartWidth);
    const gridWidth = chartWidth - dayLabelWidth;
    const x = dayLabelWidth + (hourPosition / 24) * gridWidth;

    return {
      type: 'text',
      style: {
        text: hourLabel,
        x,
        y: HEADER_HEIGHT / 2,
        textAlign: 'left',
        textVerticalAlign: 'middle',
        fontSize: 11,
        fontWeight: 400,
        fill: COLOR_TEXT,
      },
    };
  }

  // Render function for grid background with day labels
  function renderGridBackground(params: RenderItemParams): RenderItemReturn {
    const chartWidth = params.coordSys.width;
    const dayLabelWidth = getDayLabelWidth(chartWidth);
    const numRows = options.numRows.value;
    const gridWidth = chartWidth - dayLabelWidth;
    const gridHeight = numRows * ROW_HEIGHT;

    const children: RenderItemReturn[] = [];

    // Day labels on the left
    for (let i = 0; i < numRows; i++) {
      const labelData = parsedDayLabels.value[i];
      if (!labelData) continue;

      // Day name (e.g., "Thu")
      children.push({
        type: 'text',
        style: {
          text: labelData.dayName,
          x: dayLabelWidth / 2,
          y: HEADER_HEIGHT + i * ROW_HEIGHT + ROW_HEIGHT / 2 - 7,
          textAlign: 'center',
          textVerticalAlign: 'middle',
          fontSize: 11,
          fontWeight: 500,
          fill: COLOR_TEXT,
        },
      });

      // Day number (e.g., "8")
      children.push({
        type: 'text',
        style: {
          text: labelData.dayNum,
          x: dayLabelWidth / 2,
          y: HEADER_HEIGHT + i * ROW_HEIGHT + ROW_HEIGHT / 2 + 7,
          textAlign: 'center',
          textVerticalAlign: 'middle',
          fontSize: 13,
          fontWeight: 600,
          fill: COLOR_TEXT,
        },
      });
    }

    // Grid border
    children.push({
      type: 'rect',
      shape: {
        x: dayLabelWidth,
        y: HEADER_HEIGHT,
        width: gridWidth,
        height: gridHeight,
        r: GRID_BORDER_RADIUS,
      },
      style: {
        fill: 'transparent',
        stroke: COLOR_BORDER,
        lineWidth: 1,
      },
    });

    // Vertical dividers at 6-hour intervals
    const hourDividers = [6, 12, 18];
    hourDividers.forEach((hour) => {
      const x = dayLabelWidth + (hour / 24) * gridWidth;
      children.push({
        type: 'line',
        shape: {
          x1: x,
          y1: HEADER_HEIGHT,
          x2: x,
          y2: HEADER_HEIGHT + gridHeight,
        },
        style: {
          stroke: COLOR_BORDER,
          lineWidth: 1,
        },
      });
    });

    // Horizontal dividers between rows
    for (let i = 1; i < numRows; i++) {
      const y = HEADER_HEIGHT + i * ROW_HEIGHT;
      children.push({
        type: 'line',
        shape: {
          x1: dayLabelWidth,
          y1: y,
          x2: chartWidth,
          y2: y,
        },
        style: {
          stroke: COLOR_BORDER,
          lineWidth: 1,
        },
      });
    }

    return {
      type: 'group',
      children,
    };
  }

  // Render function for timeline bars
  function renderTimelineBar(params: RenderItemParams, api: RenderItemAPI): RenderItemReturn {
    const dayIndex = api.value(0) as number;
    const startHour = api.value(1) as number;
    const endHour = api.value(2) as number;
    const barIndex = api.value(3) as number;

    const barData = options.timelineBars.value[barIndex];
    if (!barData) return { type: 'group', children: [] };

    const { type, duration } = barData;
    const chartWidth = params.coordSys.width;
    const dayLabelWidth = getDayLabelWidth(chartWidth);
    const gridWidth = chartWidth - dayLabelWidth;

    // Calculate bar dimensions
    const barX = dayLabelWidth + (startHour / 24) * gridWidth + BAR_PADDING_HORIZONTAL;
    const barWidth = ((endHour - startHour) / 24) * gridWidth - BAR_PADDING_HORIZONTAL * 2;
    const barY = HEADER_HEIGHT + dayIndex * ROW_HEIGHT + BAR_PADDING_TOP;

    const finalWidth = Math.max(barWidth, 2);
    const barColor = type === 'fasting' ? COLOR_FASTING : COLOR_EATING;

    const children: RenderItemReturn[] = [
      {
        type: 'rect',
        shape: {
          x: 0,
          y: 0,
          width: finalWidth,
          height: BAR_HEIGHT,
          r: BAR_BORDER_RADIUS,
        },
        style: {
          fill: barColor,
        },
      },
    ];

    // Duration label (only show if bar is wide enough)
    if (finalWidth > 25) {
      const fontSize = chartWidth < MOBILE_BREAKPOINT ? 10 : 11;
      children.push({
        type: 'text',
        style: {
          text: duration,
          x: finalWidth / 2,
          y: BAR_HEIGHT / 2,
          textAlign: 'center',
          textVerticalAlign: 'middle',
          fontSize,
          fontWeight: 600,
          fill: COLOR_BAR_TEXT,
        },
      });
    }

    return {
      type: 'group',
      x: barX,
      y: barY,
      children,
    };
  }

  // Calculate total chart height
  const chartHeight = computed(() => {
    return HEADER_HEIGHT + options.numRows.value * ROW_HEIGHT;
  });

  // Build chart options
  function buildChartOptions(): ECOption {
    return {
      animation: false,
      grid: {
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
      },
      xAxis: {
        type: 'value',
        min: 0,
        max: 24,
        show: false,
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: options.numRows.value,
        show: false,
      },
      series: [
        // Series 0: Hour labels header
        {
          type: 'custom',
          renderItem: renderHourLabels as unknown as CustomRenderItem,
          data: hourLabelsData.value,
          silent: true,
        },
        // Series 1: Grid background with day labels
        {
          type: 'custom',
          renderItem: renderGridBackground as unknown as CustomRenderItem,
          data: [{ value: [0] }],
          silent: true,
        },
        // Series 2: Timeline bars
        {
          type: 'custom',
          renderItem: renderTimelineBar as unknown as CustomRenderItem,
          data: timelineBarsData.value,
          silent: true,
        },
      ],
    };
  }

  // Initialize chart
  function initChart() {
    if (!chartContainer.value) return;

    // Dispose any existing chart on the container
    const existingChart = echarts.getInstanceByDom(chartContainer.value);
    if (existingChart) {
      existingChart.dispose();
    }

    chartInstance.value = echarts.init(chartContainer.value);
    chartInstance.value.setOption(buildChartOptions());
  }

  // Setup lifecycle (resize observer, cleanup)
  const { refresh } = useChartLifecycle({
    chartContainer,
    chartInstance,
    buildChartOptions,
    initChart,
  });

  // Watch for data changes
  watch(
    [options.numRows, options.dayLabels, options.timelineBars],
    () => {
      refresh();
    },
    { deep: true },
  );

  return {
    chartInstance,
    chartHeight,
    refresh,
  };
}
