"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import ChartCard from "@/components/charts/ChartCard";
import { formatNumber } from "@/lib/format";

export default function PieChartCard({ title, subtitle, data, height }) {
  const hasData = Array.isArray(data) && data.length > 0;

  return (
    <ChartCard title={title} subtitle={subtitle} height={height}>
      {hasData ? (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="label" innerRadius={50} outerRadius={90}>
              {data.map((entry) => (
                <Cell key={entry.label} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) => formatNumber(value)}
              contentStyle={{ borderRadius: 12, borderColor: "#e2e8f0" }}
              labelStyle={{ fontSize: 12, color: "#475569" }}
            />
          </PieChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex h-full items-center justify-center text-sm text-slate-400">
          No chart data available
        </div>
      )}
    </ChartCard>
  );
}
