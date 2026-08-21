'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { SectionCard, fmtINR } from '../_components/shared';
import { ascend, riskMeta } from '../_lib/theme';
import { DEMO_RETAILERS, STATE_RANK } from '../_data/retailers';

const STATE_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'window_exceeded', label: 'Window exceeded' },
  { key: 'likely_due', label: 'Likely due' },
  { key: 'awaiting_reply', label: 'Awaiting reply' },
  { key: 'call_requested', label: 'Call requested' },
  { key: 'order_confirmed', label: 'Confirmed' },
  { key: 'declined', label: 'Declined' },
];

function riskLevel(r) {
  if (r.state === 'window_exceeded') return 'high';
  if (r.state === 'likely_due' || r.state === 'awaiting_reply' || r.state === 'call_requested') return 'medium';
  return 'low';
}

const action = {
  window_exceeded: 'Run AI agent',
  likely_due: 'Run AI agent',
  awaiting_reply: 'Follow up',
  call_requested: 'Escalate to voice',
  whatsapp_sent: 'Await reply',
  order_confirmed: 'Hand to ops',
  on_cycle: 'Monitor',
  declined: 'Snooze',
};

export default function RetailerIntelligence() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');

  const rows = useMemo(() => {
    return [...DEMO_RETAILERS]
      .filter((r) => (filter === 'all' ? true : r.state === filter))
      .filter((r) => (q ? (r.name + r.location + r.outletId).toLowerCase().includes(q.toLowerCase()) : true))
      .sort((a, b) => STATE_RANK[a.state] - STATE_RANK[b.state]);
  }, [q, filter]);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-[22px]" style={{ fontWeight: 720, color: ascend.ink, letterSpacing: '-0.02em' }}>Retailer Intelligence</h1>
        <p className="text-[13px] mt-0.5" style={{ color: ascend.muted }}>Retailers ranked by likely replenishment opportunity</p>
      </div>

      <SectionCard>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 rounded-lg px-3 py-1.5 border" style={{ borderColor: 'var(--demo-border)', background: ascend.warmWhite }}>
            <Search size={14} style={{ color: ascend.metal }} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search retailers…" className="bg-transparent outline-none text-[13px] w-40 sm:w-56" style={{ color: ascend.ink }} />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {STATE_FILTERS.map((f) => (
              <button key={f.key} onClick={() => setFilter(f.key)} className="text-[11.5px] rounded-md px-2.5 py-1 transition-colors"
                style={{ background: filter === f.key ? ascend.carbon : ascend.paper, color: filter === f.key ? ascend.cream : ascend.muted, fontWeight: 600 }}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ color: ascend.muted }} className="text-[11px] uppercase tracking-wide">
                <th className="py-2 pr-3 font-medium">Outlet</th>
                <th className="py-2 px-3 font-medium">Last order</th>
                <th className="py-2 px-3 font-medium">Cycle</th>
                <th className="py-2 px-3 font-medium">Risk</th>
                <th className="py-2 px-3 font-medium">Basket value</th>
                <th className="py-2 px-3 font-medium">Channel</th>
                <th className="py-2 pl-3 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const lvl = riskLevel(r);
                return (
                  <tr key={r.id} onClick={() => router.push(`/demo/retailers/${r.id}`)} className="cursor-pointer border-t hover:bg-black/[0.015]" style={{ borderColor: 'var(--demo-border)' }}>
                    <td className="py-2.5 pr-3">
                      <div className="text-[13px]" style={{ fontWeight: 600, color: ascend.ink }}>{r.name}</div>
                      <div className="text-[11px]" style={{ color: ascend.muted }}>{r.outletId} · {r.location}</div>
                    </td>
                    <td className="py-2.5 px-3 text-[12.5px]" style={{ color: ascend.ink }}>{r.daysSinceLastOrder}d ago</td>
                    <td className="py-2.5 px-3 text-[12.5px]" style={{ color: ascend.muted }}>~{r.medianReorderDays}d</td>
                    <td className="py-2.5 px-3">
                      <span className="text-[11px] rounded-md px-2 py-0.5" style={{ background: riskMeta[lvl].bg, color: riskMeta[lvl].color, fontWeight: 600 }}>{riskMeta[lvl].label}</span>
                    </td>
                    <td className="py-2.5 px-3 text-[12.5px]" style={{ color: ascend.ink, fontWeight: 600 }}>{fmtINR(r.avgBasketValue)}</td>
                    <td className="py-2.5 px-3 text-[12px]" style={{ color: ascend.muted }}>WhatsApp</td>
                    <td className="py-2.5 pl-3 text-right">
                      <span className="text-[11.5px] rounded-md px-2 py-1" style={{ background: ascend.limeWash, color: ascend.limeDark, fontWeight: 600 }}>{action[r.state]}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {rows.length === 0 && <div className="py-10 text-center text-[13px]" style={{ color: ascend.muted }}>No retailers match your filters.</div>}
        </div>
      </SectionCard>
    </div>
  );
}
