'use client';

import { ArrowDown, CheckCircle2, Loader2, Clock } from 'lucide-react';
import { SectionCard } from '../_components/shared';
import { ascend } from '../_lib/theme';

const TYPE_STYLE = {
  CODE: { color: '#5b6470', bg: 'rgba(91,100,112,0.12)' },
  'GOOGLE SHEETS': { color: ascend.riskLow, bg: 'rgba(78,125,62,0.14)' },
  FIXTURE: { color: '#8a6d1f', bg: 'rgba(233,178,50,0.16)' },
  AI: { color: ascend.carbon, bg: ascend.lime },
  TOOL: { color: '#2f6f7a', bg: 'rgba(47,111,122,0.14)' },
  HUMAN: { color: ascend.orange, bg: 'rgba(233,113,50,0.14)' },
  PROXY: { color: '#5b6470', bg: 'rgba(91,100,112,0.12)' },
};

function Node({ title, type }) {
  const k = TYPE_STYLE[type] ?? TYPE_STYLE.CODE;
  return (
    <div className="rounded-xl border bg-card px-4 py-2.5 w-full max-w-[440px] flex items-center justify-between gap-3" style={{ borderColor: 'var(--demo-border)' }}>
      <span className="text-[12.5px]" style={{ fontWeight: 600, color: ascend.ink }}>{title}</span>
      {type && <span className="text-[9.5px] uppercase tracking-wider rounded px-1.5 py-0.5 shrink-0" style={{ background: k.bg, color: k.color, fontWeight: 700 }}>{type}</span>}
    </div>
  );
}

const Arrow = () => <ArrowDown size={15} style={{ color: ascend.metal }} />;

const IMPLEMENTED = [
  ['Ascend Foods frontend', 'CODE'],
  ['Next.js proxy · /demo/api/agent/analyse', 'PROXY'],
  ['n8n webhook', 'CODE'],
  ['Load Demo Data (temporary)', 'FIXTURE'],
  ['Order Parser', 'CODE'],
  ['Calculate Reorder Signals', 'CODE'],
  ['Reorder Decision Agent', 'AI'],
  ['Validate Reorder Basket', 'TOOL'],
  ['Validate Final Recommendation', 'CODE'],
  ['Human Approval Guard', 'HUMAN'],
];

export default function WorkflowArchitecture() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-[22px]" style={{ fontWeight: 720, color: ascend.ink, letterSpacing: '-0.02em' }}>Workflow Architecture</h1>
        <p className="text-[13px] mt-0.5" style={{ color: ascend.muted }}>What is implemented now, what is being connected, and what is future</p>
      </div>

      <SectionCard
        title="Implemented now"
        action={<span className="inline-flex items-center gap-1 text-[11px]" style={{ color: ascend.limeDark, fontWeight: 600 }}><CheckCircle2 size={13} /> Live-ready</span>}
        subtitle="The frontend is the UI; n8n does the work. Exactly one AI agent."
      >
        <div className="flex flex-col items-center gap-2">
          {IMPLEMENTED.map(([title, type], i) => (
            <div key={title} className="flex flex-col items-center gap-2 w-full">
              <Node title={title} type={type} />
              {i < IMPLEMENTED.length - 1 && <Arrow />}
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="Being connected now"
        action={<span className="inline-flex items-center gap-1 text-[11px]" style={{ color: ascend.riskLow, fontWeight: 600 }}><Loader2 size={13} /> In progress</span>}
        subtitle="The temporary fixture loader is being replaced with Google Sheets"
      >
        <div className="flex flex-col items-center gap-2">
          <Node title="Google Sheets — order history" type="GOOGLE SHEETS" />
          <Arrow />
          <Node title="Google Sheets — SKU Master" type="GOOGLE SHEETS" />
        </div>
      </SectionCard>

      <SectionCard
        title="Future integrations"
        action={<span className="inline-flex items-center gap-1 text-[11px]" style={{ color: '#8a6d1f', fontWeight: 600 }}><Clock size={13} /> Not built</span>}
        subtitle="Not active or completed — shown for context only"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {['Approved WhatsApp send workflow', 'Interakt', 'Inbound retailer replies', 'Order creation', 'Dark-store & rider handoff', 'Voice escalation'].map((t) => (
            <div key={t} className="rounded-lg border border-dashed px-3 py-2 text-[12px]" style={{ borderColor: 'var(--demo-border)', color: ascend.muted }}>{t}</div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
