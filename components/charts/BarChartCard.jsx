"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import ChartCard from "@/components/charts/ChartCard";
import { formatNumber } from "@/lib/format";

export default function BarChartCard({ title, subtitle, data, bars = [], height }) {
  const hasData = Array.isArray(data) && data.length > 0;

  return (
    <ChartCard title={title} subtitle={subtitle} height={height}>
      {hasData ? (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="#94a3b8" />
            <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" tickFormatter={(value) => formatNumber(value)} />
            <Tooltip
              formatter={(value) => formatNumber(value)}
              contentStyle={{ borderRadius: 12, borderColor: "#e2e8f0" }}
              labelStyle={{ fontSize: 12, color: "#475569" }}
            />
            {bars.map((bar) => (
              <Bar
                key={bar.dataKey}
                dataKey={bar.dataKey}
                fill={bar.color}
                radius={[6, 6, 0, 0]}
                name={bar.name}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex h-full items-center justify-center text-sm text-slate-400">
          No chart data available
        </div>
      )}
    </ChartCard>
  );
}
