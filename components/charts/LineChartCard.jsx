"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import ChartCard from "@/components/charts/ChartCard";
import { formatNumber } from "@/lib/format";

export default function LineChartCard({ title, subtitle, data, lines = [], height }) {
  const hasData = Array.isArray(data) && data.length > 0;

  return (
    <ChartCard title={title} subtitle={subtitle} height={height}>
      {hasData ? (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="#94a3b8" />
            <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" tickFormatter={(value) => formatNumber(value)} />
            <Tooltip
              formatter={(value) => formatNumber(value)}
              contentStyle={{ borderRadius: 12, borderColor: "#e2e8f0" }}
              labelStyle={{ fontSize: 12, color: "#475569" }}
            />
            {lines.map((line) => (
              <Line
                key={line.dataKey}
                type="monotone"
                dataKey={line.dataKey}
                stroke={line.color}
                strokeWidth={2.5}
                dot={false}
                name={line.name}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex h-full items-center justify-center text-sm text-slate-400">
          No chart data available
        </div>
      )}
    </ChartCard>
  );
}
