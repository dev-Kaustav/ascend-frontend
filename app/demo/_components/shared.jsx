'use client';

import { ascend } from '../_lib/theme';

export function fmtINR(n) {
  return `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;
}

export function AscendLogo({ compact = false }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="grid place-items-center rounded-lg shrink-0" style={{ width: 30, height: 30, background: ascend.lime }}>
        <span style={{ color: ascend.carbon, fontWeight: 800, fontSize: 16, lineHeight: 1 }}>A</span>
      </div>
      {!compact && (
        <div className="flex flex-col leading-none">
          <span style={{ color: 'inherit', fontWeight: 700, fontSize: 15, letterSpacing: '-0.01em' }}>Ascend Foods</span>
          <span style={{ color: ascend.metal, fontSize: 9.5, letterSpacing: '0.12em', marginTop: 2 }}>AI REPLENISHMENT</span>
        </div>
      )}
    </div>
  );
}

export function SectionCard({ title, subtitle, action, children, className = '' }) {
  return (
    <div className={`rounded-xl border bg-card ${className}`} style={{ borderColor: 'var(--demo-border)' }}>
      {(title || action) && (
        <div className="flex items-start justify-between gap-4 px-5 pt-4 pb-3">
          <div>
            {title && <h3 className="text-[13.5px]" style={{ fontWeight: 650, color: ascend.ink }}>{title}</h3>}
            {subtitle && <p className="text-[11.5px] mt-0.5" style={{ color: ascend.muted }}>{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      <div className={title ? 'px-5 pb-5' : 'p-5'}>{children}</div>
    </div>
  );
}

function Pill({ label, color, bg, dot }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[10.5px] uppercase tracking-wider" style={{ background: bg, color, fontWeight: 700 }}>
      {dot && <span className="rounded-full" style={{ width: 6, height: 6, background: color }} />}
      {label}
    </span>
  );
}

/* ── Orchestrator: where the analysis actually ran ── */
export function OrchestratorBadge({ orchestrator }) {
  const live = orchestrator === 'n8n';
  return <Pill label={live ? 'N8N Live' : 'Local Simulation'} dot color={live ? ascend.orange : '#5b6470'} bg={live ? 'rgba(233,113,50,0.14)' : 'rgba(91,100,112,0.12)'} />;
}

/* ── Data source: where the underlying data came from ── */
export function DataSourceBadge({ dataSource }) {
  const sheets = dataSource === 'google_sheets';
  return <Pill label={sheets ? 'Google Sheets' : 'Fixture Data'} color={sheets ? ascend.riskLow : '#5b6470'} bg={sheets ? 'rgba(78,125,62,0.14)' : 'rgba(91,100,112,0.12)'} />;
}

export function DemoDatasetBadge() {
  return <Pill label="Demo Dataset" color="#5b6470" bg="rgba(91,100,112,0.12)" />;
}

/* ── Trace step type badges — only AI is highlighted ── */
const TYPE_STYLE = {
  AI: { color: ascend.carbon, bg: ascend.lime },
  CODE: { color: '#5b6470', bg: 'rgba(91,100,112,0.12)' },
  'GOOGLE SHEETS': { color: ascend.riskLow, bg: 'rgba(78,125,62,0.14)' },
  FIXTURE: { color: '#8a6d1f', bg: 'rgba(233,178,50,0.16)' },
  TOOL: { color: '#2f6f7a', bg: 'rgba(47,111,122,0.14)' },
  HUMAN: { color: ascend.orange, bg: 'rgba(233,113,50,0.14)' },
};
export function TypeBadge({ type }) {
  const s = TYPE_STYLE[type] ?? TYPE_STYLE.CODE;
  return <span className="text-[9.5px] uppercase tracking-wider rounded px-1.5 py-0.5" style={{ background: s.bg, color: s.color, fontWeight: 700 }}>{type}</span>;
}

/* ── SKU signal status ── */
const SIGNAL_STYLE = {
  overdue: { label: 'Reorder window reached', color: ascend.riskHigh, bg: 'rgba(192,52,29,0.10)' },
  due: { label: 'Due now', color: ascend.orange, bg: 'rgba(233,113,50,0.12)' },
  due_soon: { label: 'Due soon', color: ascend.orange, bg: 'rgba(233,113,50,0.12)' },
  approaching: { label: 'Approaching', color: '#8a6d1f', bg: 'rgba(233,178,50,0.16)' },
  on_cycle: { label: 'On cycle', color: ascend.riskLow, bg: 'rgba(78,125,62,0.12)' },
};
export function SignalBadge({ status }) {
  const s = SIGNAL_STYLE[status] ?? SIGNAL_STYLE.on_cycle;
  return <span className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px]" style={{ background: s.bg, color: s.color, fontWeight: 600 }}>
    <span className="rounded-full" style={{ width: 6, height: 6, background: s.color }} />{s.label}
  </span>;
}

/* ── Generic status chip for the executions list ── */
const STATUS_STYLE = {
  AWAITING_HUMAN_APPROVAL: { label: 'Awaiting approval', color: '#8a6d1f', bg: 'rgba(233,178,50,0.16)' },
  RECOMMENDATION_READY: { label: 'Ready', color: ascend.limeDark, bg: 'rgba(110,142,23,0.14)' },
  APPROVED: { label: 'Approved', color: ascend.riskLow, bg: 'rgba(78,125,62,0.14)' },
  ERROR: { label: 'Error', color: ascend.riskHigh, bg: 'rgba(192,52,29,0.12)' },
};
export function StatusChip({ status }) {
  const s = STATUS_STYLE[status] ?? { label: status, color: ascend.muted, bg: 'rgba(96,101,95,0.10)' };
  return <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px]" style={{ background: s.bg, color: s.color, fontWeight: 600 }}>{s.label}</span>;
}

/* Combined orchestrator + data-source row used on analysis/execution views. */
export function ProvenanceBadges({ orchestrator, dataSource }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <OrchestratorBadge orchestrator={orchestrator} />
      <DataSourceBadge dataSource={dataSource} />
    </div>
  );
}
