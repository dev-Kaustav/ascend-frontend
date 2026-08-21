'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Loader2, Sparkles } from 'lucide-react';
import { useDemo } from '../../_components/DemoProvider';
import { SectionCard, fmtINR, ProvenanceBadges } from '../../_components/shared';
import { ascend } from '../../_lib/theme';
import { RETAILER_BY_ID } from '../../_data/retailers';
import {
  AgentTrace, AnalysisFacts, ApprovalPanel, ApprovedPanel, ErrorCard,
  OrderHistoryChart, SkuSignals, StageRail,
} from '../../_components/WorkflowPieces';

const LANG = { en: 'English', hi: 'Hindi', hinglish: 'Hinglish' };

function Meta({ label, value }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b last:border-0" style={{ borderColor: 'var(--demo-border)' }}>
      <span className="text-[11.5px]" style={{ color: ascend.muted }}>{label}</span>
      <span className="text-[12px]" style={{ color: ascend.ink, fontWeight: 600 }}>{value}</span>
    </div>
  );
}

export default function RetailerWorkflow() {
  const params = useParams();
  const id = params?.id ?? '';
  const { retailer, selectRetailer, stage, busy, analysis, error, runAnalysis, mode } = useDemo();

  useEffect(() => {
    if (id && (!retailer || retailer.id !== id)) selectRetailer(id);
  }, [id, retailer, selectRetailer]);

  const r = retailer ?? RETAILER_BY_ID[id];
  if (!r) {
    return <div className="text-[14px]" style={{ color: ascend.muted }}>Retailer not found. <Link href="/demo/retailers" className="underline">Back to list</Link></div>;
  }

  // Prefer n8n-returned retailer values once analysis exists.
  const ar = analysis?.retailer;
  const name = ar?.retailerName ?? r.name;
  const outletId = ar?.outletId ?? r.outletId;
  const location = ar?.location ?? r.location;

  const showApproval = stage === 'AWAITING_HUMAN_APPROVAL' || stage === 'RECOMMENDATION_READY';

  return (
    <div className="flex flex-col gap-4">
      <Link href="/demo/retailers" className="inline-flex items-center gap-1.5 text-[12.5px]" style={{ color: ascend.muted }}>
        <ArrowLeft size={14} /> Retailer Intelligence
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px]" style={{ fontWeight: 720, color: ascend.ink, letterSpacing: '-0.02em' }}>{name}</h1>
          <p className="text-[12.5px] mt-0.5" style={{ color: ascend.muted }}>{outletId} · {location} · {r.type}</p>
        </div>
        {analysis && <ProvenanceBadges orchestrator={analysis.orchestrator} dataSource={analysis.dataSource} />}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[330px_minmax(0,1fr)] gap-5 items-start">
        {/* Left: retailer detail */}
        <div className="flex flex-col gap-5 min-w-0">
          <SectionCard title="Retailer profile">
            <Meta label="Phone (masked)" value={ar?.phoneMasked ?? ar?.phone ?? r.phoneMasked} />
            <Meta label="Preferred language" value={LANG[ar?.preferredLanguage ?? r.preferredLanguage]} />
            <Meta label="Payment preference" value={ar?.paymentPreference ?? r.paymentPreference} />
            <Meta label="Dark store" value={ar?.darkStore ?? r.darkStore} />
            {!analysis && <Meta label="Last order" value={`${r.daysSinceLastOrder} days ago`} />}
            {!analysis && <Meta label="Usual reorder cycle" value={`~${r.medianReorderDays} days`} />}
          </SectionCard>

          {analysis?.analysisFacts && (
            <SectionCard title="Analysis facts" subtitle="From delivered-order history">
              <AnalysisFacts facts={analysis.analysisFacts} />
            </SectionCard>
          )}

          {!analysis && (
            <SectionCard title="Order history" subtitle="Delivered bills (recent)">
              <OrderHistoryChart outletId={r.outletId} />
            </SectionCard>
          )}
        </div>

        {/* Right: workflow */}
        <div className="flex flex-col gap-5 min-w-0">
          {stage !== 'READY' && (
            <div className="rounded-xl border bg-card px-4 py-3" style={{ borderColor: 'var(--demo-border)' }}>
              <StageRail stage={stage} />
            </div>
          )}

          {stage === 'READY' && (
            <SectionCard title="Run the replenishment agent" subtitle="Read-only analysis — this does not contact the retailer.">
              <p className="text-[12.5px] mb-3" style={{ color: ascend.muted }}>
                {mode === 'live'
                  ? 'n8n reads order history + SKU Master from Google Sheets, computes reorder signals, and the Reorder Decision Agent proposes a basket for your approval.'
                  : 'Local simulation reads fixture order history, computes reorder signals deterministically, and proposes a basket for your approval. No OpenAI, Sheets or network.'}
              </p>
              <button onClick={() => runAnalysis()} disabled={busy} className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-[13px] disabled:opacity-50" style={{ background: ascend.lime, color: ascend.carbon, fontWeight: 700 }}>
                {busy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} Run AI Agent
              </button>
            </SectionCard>
          )}

          {stage === 'ANALYSING' && (
            <SectionCard title="Analysing…">
              <div className="flex items-center gap-2 text-[13px]" style={{ color: ascend.muted }}>
                <Loader2 size={16} className="animate-spin" /> {mode === 'live' ? 'Calling n8n → Google Sheets → Reorder Decision Agent…' : 'Computing reorder signals from delivered-order history…'}
              </div>
            </SectionCard>
          )}

          {analysis?.trace?.length ? (
            <SectionCard title="Workflow execution trace" subtitle="Mirrors the n8n workflow nodes">
              <AgentTrace trace={analysis.trace} />
            </SectionCard>
          ) : null}

          {analysis?.skuSignals?.length ? (
            <SectionCard title="Reorder signals" subtitle="Deterministic, based on historical purchase frequency">
              <SkuSignals signals={analysis.skuSignals} />
            </SectionCard>
          ) : null}

          {showApproval && <ApprovalPanel />}
          {stage === 'APPROVED' && <ApprovedPanel />}
          {stage === 'ERROR' && error && <ErrorCard message={error} />}
        </div>
      </div>
    </div>
  );
}
