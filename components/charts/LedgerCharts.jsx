"use client";

import { Bar, BarChart, Cell, CartesianGrid, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

// Charts for the staff desktop, drawn to one set of rules: a single series per chart, three to
// five faint horizontal gridlines and no axis lines, square bars, ticks at 12px in grey, a plain
// tooltip. The past is ink; the one hue (Ascend maroon) marks the period that matters now.
const INK = "#1f1f1f";
const DATA = "#5e0b26";
const GRID = "#ececec";
const TICK = { fontSize: 12, fill: "#6b6b6b" };

function PlainTooltip({ active, payload, label, format, labelFormat }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-line bg-white px-2.5 py-1.5 text-xs shadow-[0_4px_16px_rgba(0,0,0,0.08)]">
      <span className="text-muted">{labelFormat ? labelFormat(label) : label}</span>
      <span className="ml-2 font-medium tabular-nums text-ink">{format(payload[0].value)}</span>
    </div>
  );
}

// Round, even y ticks with the top one above the largest value: steps of 1, 2, 2.5 or 5 times a
// power of ten, four of them. A chart of all zeros still gets a scale.
function roundTicks(max, count = 4) {
  if (!(max > 0)) return [0, 1, 2, 3, 4];
  const raw = max / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((candidate) => candidate >= raw);
  const top = Math.ceil(max / step) * step === max ? max + step : Math.ceil(max / step) * step;
  const ticks = [];
  for (let value = 0; value <= top + step / 2; value += step) ticks.push(Number(value.toFixed(6)));
  return ticks;
}

// Columns per period with the last one (the current period) in the data hue.
export function PeriodColumns({ data, dataKey, xKey = "label", format = String, axisFormat, labelFormat, height = 220 }) {
  const last = data.length - 1;
  const ticks = roundTicks(Math.max(0, ...data.map((row) => Number(row[dataKey]) || 0)));
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: 4, bottom: 0 }} barCategoryGap="22%">
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey={xKey} tick={TICK} tickLine={false} axisLine={{ stroke: "#d4d4d4" }} interval="preserveStartEnd" minTickGap={18} />
          <YAxis tick={TICK} tickLine={false} axisLine={false} width={56} ticks={ticks} domain={[0, ticks.at(-1)]} tickFormatter={axisFormat || format} />
          <Tooltip cursor={{ fill: "rgba(0,0,0,0.04)" }} content={<PlainTooltip format={format} labelFormat={labelFormat} />} />
          <Bar dataKey={dataKey} isAnimationActive={false}>
            {data.map((_, index) => (
              <Cell key={index} fill={index === last ? DATA : INK} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// A thin ring for three to five parts of a whole; the legend beside it carries the numbers.
export function ThinRing({ parts, size = 132 }) {
  const total = parts.reduce((sum, part) => sum + part.value, 0);
  return (
    <div style={{ width: size, height: size }} className="shrink-0">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={total ? parts : [{ label: "None", value: 1, color: GRID }]}
            dataKey="value"
            nameKey="label"
            innerRadius={size / 2 - 12}
            outerRadius={size / 2 - 2}
            paddingAngle={total && parts.filter((p) => p.value).length > 1 ? 2 : 0}
            stroke="none"
            isAnimationActive={false}
          >
            {(total ? parts : [{ color: GRID }]).map((part, index) => (
              <Cell key={index} fill={part.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
