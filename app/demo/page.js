'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Activity, Info } from 'lucide-react';
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { useDemo } from './_components/DemoProvider';
import { SectionCard, fmtINR, StatusChip, DemoDatasetBadge } from './_components/shared';
import { ascend, riskMeta } from './_lib/theme';
import { DEMO_RETAILERS, STATE_RANK } from './_data/retailers';
import { computeOverview } from './_lib/overview';

function MetricCard({ label, value, hint }) {
  return (
    <div className="rounded-xl border bg-card px-4 py-3.5" style={{ borderColor: 'var(--demo-border)' }}>
      <span className="text-[11.5px]" style={{ color: ascend.muted }}>{label}</span>
      <div className="mt-1.5 text-[22px]" style={{ fontWeight: 720, color: ascend.ink, letterSpacing: '-0.02em' }}>{value}</div>
      {hint && <div className="text-[11px] mt-0.5" style={{ color: ascend.metal }}>{hint}</div>}
    </div>
  );
}

const stateLabel = {
  window_exceeded: 'Reorder window exceeded',
  likely_due: 'Likely replenishment due',
  awaiting_reply: 'Awaiting reply',
  call_requested: 'Call requested',
  whatsapp_sent: 'WhatsApp sent',
  order_confirmed: 'Order confirmed',
  on_cycle: 'On cycle',
  declined: 'Declined',
};

const pipelineColor = {
  'Likely due': ascend.orange,
  'WhatsApp sent': ascend.carbon,
  'Call requested': ascend.carbon,
  Confirmed: ascend.limeDark,
  Declined: ascend.metal,
  'On cycle': ascend.metal,
};

export default function CommandCentre() {
  const router = useRouter();
  const { executions } = useDemo();

  // Every headline number is derived from the retailer dataset (single source of truth).
  const ov = useMemo(() => computeOverview(DEMO_RETAILERS), []);
  const ranked = useMemo(() => [...DEMO_RETAILERS].sort((a, b) => STATE_RANK[a.state] - STATE_RANK[b.state]).slice(0, 5), []);
  const avgDueBasket = ov.dueCount ? Math.round(ov.recoverableGMV / ov.dueCount) : 0;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[24px]" style={{ fontWeight: 720, color: ascend.ink, letterSpacing: '-0.02em' }}>Ascend Foods</h1>
            <DemoDatasetBadge />
          </div>
          <p className="text-[13px] mt-0.5" style={{ color: ascend.muted }}>
            AI replenishment command centre · {ov.darkStores} dark store{ov.darkStores === 1 ? '' : 's'} ({ov.darkStoreNames}) · figures computed from the demo dataset
          </p>
        </div>
        <button onClick={() => router.push('/demo/retailers/RET-1027')} className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-[13px]" style={{ background: ascend.lime, color: ascend.carbon, fontWeight: 700 }}>
          Launch Guided Demo <ArrowRight size={15} />
        </button>
      </div>

      {/* KPIs — all derived from the dataset, except the 4-hour SLA target. */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <MetricCard label="Active retailers" value={ov.total} hint="In the dataset" />
        <MetricCard label="Likely replenishment-due" value={ov.dueCount} hint="Reorder window crossed" />
        <MetricCard label="Awaiting reply" value={ov.awaitingCount} hint="Nudge sent" />
        <MetricCard label="Confirmed" value={ov.confirmedCount} hint="Orders today" />
        <MetricCard label="Est. recoverable GMV" value={fmtINR(ov.recoverableGMV)} hint="Due × avg basket" />
        <MetricCard label="Delivery SLA" value="4 hrs" hint="Dark-store target" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <SectionCard title="Retailer pipeline" subtitle="Live breakdown of the current dataset" className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={ov.pipeline} margin={{ top: 6, right: 6, left: 6, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: ascend.muted }} axisLine={false} tickLine={false} interval={0} />
              <Tooltip cursor={{ fill: 'rgba(0,0,0,0.03)' }} contentStyle={{ borderRadius: 10, border: '1px solid rgba(0,0,0,0.08)', fontSize: 12 }} formatter={(v) => [v, 'Retailers']} />
              <Bar dataKey="v" radius={[6, 6, 0, 0]}>
                {ov.pipeline.map((p, i) => (<Cell key={i} fill={pipelineColor[p.label] ?? ascend.carbon} />))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>

        <SectionCard title="Replenishment value" subtitle="Today">
          <div className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between">
              <span className="text-[12px]" style={{ color: ascend.muted }}>Retailers due</span>
              <span className="text-[18px]" style={{ fontWeight: 720, color: ascend.ink }}>{ov.dueCount}</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-[12px]" style={{ color: ascend.muted }}>Est. recoverable GMV</span>
              <span className="text-[18px]" style={{ fontWeight: 720, color: ascend.ink }}>{fmtINR(ov.recoverableGMV)}</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-[12px]" style={{ color: ascend.muted }}>Avg basket (due)</span>
              <span className="text-[15px]" style={{ fontWeight: 650, color: ascend.ink }}>{fmtINR(avgDueBasket)}</span>
            </div>
            <div className="mt-1 rounded-lg p-3 flex items-start gap-2" style={{ background: ascend.limeWash }}>
              <Info size={14} className="shrink-0 mt-0.5" style={{ color: ascend.limeDark }} />
              <p className="text-[11px]" style={{ color: ascend.limeDark, lineHeight: 1.5 }}>
                Computed from retailer order data. In Live mode these figures come from Google Sheets via n8n —
                no hardcoded totals.
              </p>
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SectionCard title="Top replenishment opportunities" subtitle="Ranked by reorder window"
          action={<button onClick={() => router.push('/demo/retailers')} className="text-[12px]" style={{ color: ascend.limeDark, fontWeight: 600 }}>View all</button>}>
          <div className="flex flex-col">
            {ranked.map((r) => {
              const lvl = r.state === 'window_exceeded' ? 'high' : r.state === 'likely_due' ? 'medium' : 'low';
              return (
                <button key={r.id} onClick={() => router.push(`/demo/retailers/${r.id}`)} className="flex items-center justify-between gap-3 py-2.5 border-b last:border-0 text-left" style={{ borderColor: 'var(--demo-border)' }}>
                  <div className="min-w-0">
                    <div className="text-[13px] truncate" style={{ fontWeight: 600, color: ascend.ink }}>{r.name}</div>
                    <div className="text-[11px]" style={{ color: ascend.muted }}>{r.location} · last order {r.daysSinceLastOrder}d ago</div>
                  </div>
                  <span className="text-[11px] rounded-md px-2 py-0.5 shrink-0" style={{ background: riskMeta[lvl].bg, color: riskMeta[lvl].color, fontWeight: 600 }}>{stateLabel[r.state]}</span>
                </button>
              );
            })}
          </div>
        </SectionCard>

        <SectionCard title="Recent agent executions" subtitle="This browser session" action={<Activity size={15} style={{ color: ascend.metal }} />}>
          {executions.length === 0 ? (
            <div className="py-8 text-center text-[12.5px]" style={{ color: ascend.muted }}>
              No executions yet. Run the AI agent on a retailer to see it here.
            </div>
          ) : (
            <div className="flex flex-col">
              {executions.slice(0, 6).map((e) => (
                <div key={e.executionId} className="flex items-center justify-between gap-3 py-2.5 border-b last:border-0" style={{ borderColor: 'var(--demo-border)' }}>
                  <div className="min-w-0">
                    <div className="text-[12.5px] truncate" style={{ fontWeight: 600, color: ascend.ink }}>{e.retailerName}</div>
                    <div className="text-[11px]" style={{ color: ascend.muted }}>Analysis · {e.whenLabel}</div>
                  </div>
                  <StatusChip status={e.status} />
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
