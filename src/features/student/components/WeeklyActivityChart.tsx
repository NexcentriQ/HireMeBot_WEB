import { APPLICATIONS_PER_WEEKDAY } from '../lib/targets'

type DayDatum = { day: string; submitted: number }

type WeeklyActivityChartProps = {
  data: DayDatum[]
  target?: number
  maxBar?: number
}

/**
 * Compact, dependency-free SVG bar chart. Sized by its parent — the SVG uses
 * a fixed internal coordinate space so axis labels stay readable at any
 * container width.
 */
export function WeeklyActivityChart({
  data,
  target = APPLICATIONS_PER_WEEKDAY,
  maxBar
}: WeeklyActivityChartProps) {
  const WIDTH = 320
  const HEIGHT = 160
  const PAD_LEFT = 32
  const PAD_RIGHT = 8
  const PAD_TOP = 16
  const PAD_BOTTOM = 36

  const innerW = WIDTH - PAD_LEFT - PAD_RIGHT
  const innerH = HEIGHT - PAD_TOP - PAD_BOTTOM
  const maxValue = Math.max(maxBar ?? 0, target, ...data.map((d) => d.submitted))
  const scale = (v: number) => (maxValue > 0 ? (v / maxValue) * innerH : 0)

  const bandWidth = innerW / data.length
  const barWidth = Math.min(bandWidth * 0.5, 32)

  const targetY = PAD_TOP + innerH - scale(target)

  return (
    <div className="w-full overflow-hidden">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        width="100%"
        height={HEIGHT}
        role="img"
        aria-label="Weekly application activity"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* y-axis min/max ticks */}
        <text x={0} y={PAD_TOP + 4} fontSize="10" className="fill-muted-foreground">
          {maxValue}
        </text>
        <text x={0} y={PAD_TOP + innerH + 4} fontSize="10" className="fill-muted-foreground">
          0
        </text>

        {/* target line */}
        <line
          x1={PAD_LEFT}
          x2={WIDTH - PAD_RIGHT}
          y1={targetY}
          y2={targetY}
          strokeDasharray="4 4"
          className="stroke-primary/40"
          strokeWidth={1}
        />

        {/* bars */}
        {data.map((d, i) => {
          const h = scale(d.submitted)
          const x = PAD_LEFT + i * bandWidth + (bandWidth - barWidth) / 2
          const y = PAD_TOP + innerH - h
          return (
            <g key={d.day}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={h}
                rx={6}
                className="fill-primary"
              >
                <title>{`${d.day}: ${d.submitted}`}</title>
              </rect>
              <text
                x={x + barWidth / 2}
                y={y - 4}
                fontSize="11"
                textAnchor="middle"
                className="fill-foreground font-semibold"
              >
                {d.submitted}
              </text>
              <text
                x={PAD_LEFT + i * bandWidth + bandWidth / 2}
                y={HEIGHT - 10}
                fontSize="11"
                textAnchor="middle"
                className="fill-muted-foreground"
              >
                {d.day}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
