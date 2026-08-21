'use client';

import { motion } from 'motion/react';
import { toast } from 'sonner';
import { AlertTriangle, Check, ChevronRight, Clock, Minus, Plus, RotateCcw, Sparkles, ThumbsUp } from 'lucide-react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { SectionCard, fmtINR, TypeBadge, SignalBadge } from './shared';
import { ascend } from '../_lib/theme';
import { STAGE_LABEL, STAGE_RAIL } from '../_lib/stateMachine';
import { useDemo } from './DemoProvider';
import { ordersForOutlet } from '../_data/orderHistory';

/* ── Stage rail ── */
export function StageRail({ stage }) {
  const idx = STAGE_RAIL.indexOf(stage);
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1">
      {STAGE_RAIL.map((s, i) => {
        const done = idx > i && idx !== -1;
        const active = idx === i;
        return (
          <div key={s} className="flex items-center gap-1 shrink-0">
            <div className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px]"
              style={{ background: active ? ascend.lime : done ? 'rgba(110,142,23,0.12)' : ascend.paper, color: active ? ascend.carbon : done ? ascend.limeDark : ascend.muted, fontWeight: active ? 700 : 600 }}>
              {done ? <Check size={11} /> : <span className="rounded-full" style={{ width: 5, height: 5, background: 'currentColor' }} />}
              {STAGE_LABEL[s]}
            </div>
            {i < STAGE_RAIL.length - 1 && <ChevronRight size={12} style={{ color: ascend.metal }} />}
          </div>
        );
      })}
    </div>
  );
}

/* ── Workflow execution trace — mirrors the actual n8n nodes ── */
export function AgentTrace({ trace }) {
  return (
    <div className="flex flex-col gap-2">
      {trace.map((s, i) => {
        const awaiting = s.status === 'awaiting_approval';
        return (
          <motion.div key={`${s.step}-${i}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, delay: i * 0.08 }}
            className="rounded-lg border p-3 flex items-start gap-3" style={{ borderColor: 'var(--demo-border)', background: ascend.warmWhite }}>
            <span className="grid place-items-center rounded-full shrink-0 mt-0.5" style={{ width: 18, height: 18, background: awaiting ? 'rgba(233,178,50,0.18)' : 'rgba(110,142,23,0.16)' }}>
              {awaiting ? <Clock size={11} style={{ color: '#8a6d1f' }} /> : <Check size={11} style={{ color: ascend.limeDark }} />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12.5px]" style={{ fontWeight: 650, color: ascend.ink }}>{s.step}</span>
                <TypeBadge type={s.type} />
              </div>
              {s.detail && <div className="text-[11px] mt-0.5" style={{ color: ascend.muted }}>{s.detail}</div>}
              {awaiting && <div className="text-[11px] mt-0.5" style={{ color: '#8a6d1f' }}>Awaiting human approval</div>}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

/* ── Analysis facts (deterministic, from delivered-order history) ── */
export function AnalysisFacts({ facts }) {
  if (!facts) return null;
  const rows = [
    ['Delivered orders analysed', facts.deliveredOrderCount],
    ['Valid line items parsed', facts.validLineItemCount],
    ['Recurring SKUs', facts.recurringSkuCount],
  ];
  return (
    <div className="grid grid-cols-3 gap-2">
      {rows.map(([label, v]) => (
        <div key={label} className="rounded-lg border px-3 py-2.5" style={{ borderColor: 'var(--demo-border)' }}>
          <div className="text-[18px]" style={{ fontWeight: 720, color: ascend.ink }}>{v}</div>
          <div className="text-[10.5px] mt-0.5" style={{ color: ascend.muted }}>{label}</div>
        </div>
      ))}
    </div>
  );
}

/* ── SKU signals table ── */
export function SkuSignals({ signals }) {
  if (!signals?.length) return <p className="text-[12px]" style={{ color: ascend.muted }}>No recurring SKU signals.</p>;
  return (
    <div className="flex flex-col gap-1.5">
      {signals.map((s) => (
        <div key={s.skuCode} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2" style={{ borderColor: 'var(--demo-border)' }}>
          <div className="min-w-0">
            <div className="text-[12.5px] truncate" style={{ fontWeight: 600, color: ascend.ink }}>{s.skuName}</div>
            <div className="text-[11px]" style={{ color: ascend.muted }}>
              {s.purchaseCount}× ordered · ~{s.typicalCycleDays}d cycle · {s.daysSinceLastPurchase}d since last · {s.evidenceStrength} evidence
            </div>
          </div>
          <SignalBadge status={s.signalStatus} />
        </div>
      ))}
    </div>
  );
}

/* ── Order history mini-chart (fixture only) ── */
export function OrderHistoryChart({ outletId }) {
  const orders = ordersForOutlet(outletId).slice(0, 6).reverse();
  const data = orders.map((o) => ({ date: o.orderDate.slice(5), v: o.billValue }));
  if (data.length === 0) return null;
  return (
    <ResponsiveContainer width="100%" height={120}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: ascend.muted }} axisLine={false} tickLine={false} />
        <Tooltip cursor={{ fill: 'rgba(0,0,0,0.03)' }} contentStyle={{ borderRadius: 10, border: '1px solid rgba(0,0,0,0.08)', fontSize: 12 }} formatter={(v) => [fmtINR(v), 'Bill']} />
        <Bar dataKey="v" radius={[5, 5, 0, 0]} fill={ascend.limeDark} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ── WhatsApp preview — approved Hindi template, NO send/status ── */
function WhatsAppPreview({ templateVariables }) {
  const v1 = templateVariables?.retailerName ?? '';
  const v2 = templateVariables?.basketSummary ?? '';
  const v3 = templateVariables?.basketValue ?? '';
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide mb-1.5" style={{ color: ascend.muted, fontWeight: 600 }}>WhatsApp template preview</div>
      <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--demo-border)' }}>
        <div className="px-3 py-2 text-[12.5px]" style={{ background: '#075E54', color: '#fff', fontWeight: 600 }}>आपका सुझाया गया ऑर्डर</div>
        <div className="px-3 py-3 text-[12.5px] whitespace-pre-line" style={{ background: '#e7f3da', color: '#1f2a18', lineHeight: 1.6 }}>
{`नमस्ते ${v1} जी 👋

आपके पिछले ऑर्डर के पैटर्न के आधार पर, आपके नियमित प्रोडक्ट्स का स्टॉक दोबारा भरने का समय आ गया है।

सुझाया गया ऑर्डर:
${v2}

अनुमानित कुल राशि: ₹${v3}

आज 4 घंटे के अंदर डिलीवरी उपलब्ध है।

ऑर्डर कन्फर्म करने के लिए "हाँ" लिखकर जवाब दें।`}
        </div>
      </div>
      <div className="text-[10.5px] mt-1.5" style={{ color: ascend.metal }}>
        Template variables returned by the workflow. Message is not sent — the outbound WhatsApp workflow is not connected yet.
      </div>
    </div>
  );
}

/* ── Human approval checkpoint ── */
export function ApprovalPanel() {
  const { analysis, basket, basketValue, setQuantity, approve, reset, busy } = useDemo();
  const rec = analysis?.recommendation;
  if (!rec) return null;
  const confidencePct = Math.round((rec.confidence ?? 0) * 100);

  return (
    <SectionCard title="Human approval checkpoint" subtitle="Review the AI recommendation, then approve. This is a frontend checkpoint — nothing is sent.">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="text-[11.5px] rounded-md px-2 py-0.5" style={{ background: ascend.limeWash, color: ascend.limeDark, fontWeight: 600 }}>{rec.decision}</span>
        <span className="text-[11.5px] rounded-md px-2 py-0.5" style={{ background: 'rgba(91,100,112,0.12)', color: '#5b6470', fontWeight: 600 }}>{confidencePct}% confidence</span>
      </div>

      <div className="rounded-lg p-3 mb-4" style={{ background: ascend.cream }}>
        <div className="text-[11px] uppercase tracking-wide mb-1" style={{ color: ascend.muted, fontWeight: 600 }}>Reorder Decision Agent — business reason</div>
        <p className="text-[12.5px]" style={{ color: ascend.ink }}>{rec.businessReason}</p>
      </div>

      <div className="text-[11px] uppercase tracking-wide mb-1.5" style={{ color: ascend.muted, fontWeight: 600 }}>Suggested replenishment basket</div>
      <div className="flex flex-col gap-1.5 mb-2">
        {basket.map((it) => (
          <div key={it.skuCode} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2" style={{ borderColor: 'var(--demo-border)' }}>
            <div className="min-w-0">
              <div className="text-[12.5px] truncate" style={{ fontWeight: 600, color: ascend.ink }}>{it.skuName}</div>
              <div className="text-[11px]" style={{ color: ascend.muted }}>{fmtINR(it.retailerPrice)}/{it.unit}</div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-center rounded-md border" style={{ borderColor: 'var(--demo-border)' }}>
                <button onClick={() => setQuantity(it.skuCode, it.quantity - 1)} disabled={busy} className="px-1.5 py-1 disabled:opacity-40"><Minus size={12} /></button>
                <span className="text-[12.5px] w-7 text-center" style={{ fontWeight: 600 }}>{it.quantity}</span>
                <button onClick={() => setQuantity(it.skuCode, it.quantity + 1)} disabled={busy} className="px-1.5 py-1 disabled:opacity-40"><Plus size={12} /></button>
              </div>
              <span className="text-[12.5px] w-16 text-right" style={{ fontWeight: 600, color: ascend.ink }}>{fmtINR(it.lineValue)}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between mb-4 px-1">
        <span className="text-[12px]" style={{ color: ascend.muted }}>Basket value</span>
        <span className="text-[15px]" style={{ fontWeight: 720, color: ascend.ink }}>{fmtINR(basketValue)}</span>
      </div>

      <div className="mb-4"><WhatsAppPreview templateVariables={analysis.templateVariables} /></div>

      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => { approve(); toast.success('Recommendation approved'); }} disabled={busy || basket.length === 0}
          className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-[13px] disabled:opacity-50" style={{ background: ascend.lime, color: ascend.carbon, fontWeight: 700 }}>
          <ThumbsUp size={14} /> Approve recommendation
        </button>
        <button onClick={() => { reset(); toast('Recommendation rejected'); }} disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12.5px] border disabled:opacity-50" style={{ borderColor: 'var(--demo-border)', color: ascend.muted, fontWeight: 600 }}>
          Reject
        </button>
      </div>
    </SectionCard>
  );
}

/* ── Post-approval panel — honest about what is NOT connected ── */
export function ApprovedPanel() {
  return (
    <SectionCard title="Recommendation approved">
      <div className="flex items-start gap-2 rounded-lg px-3 py-3 text-[13px]" style={{ background: 'rgba(110,142,23,0.10)', color: ascend.ink }}>
        <Check size={16} className="shrink-0 mt-0.5" style={{ color: ascend.limeDark }} />
        <div>
          <p style={{ fontWeight: 600 }}>Recommendation approved.</p>
          <p className="mt-0.5" style={{ color: ascend.muted }}>The outbound WhatsApp workflow is not connected yet. No message has been sent.</p>
        </div>
      </div>
    </SectionCard>
  );
}

/* ── Error card (Live failures) — explicit, with Retry ── */
export function ErrorCard({ message }) {
  const { runAnalysis, setMode, reset } = useDemo();
  return (
    <SectionCard title="Analysis failed">
      <div className="flex items-start gap-2 text-[13px] rounded-lg px-3 py-2.5 mb-3" style={{ background: 'rgba(192,52,29,0.08)', color: ascend.riskHigh }}>
        <AlertTriangle size={15} className="shrink-0 mt-0.5" /> {message}
      </div>
      <div className="flex flex-wrap gap-2">
        <button onClick={() => runAnalysis()} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12.5px]" style={{ background: ascend.lime, color: ascend.carbon, fontWeight: 700 }}>
          <RotateCcw size={13} /> Retry
        </button>
        <button onClick={() => { reset(); setMode('simulation'); runAnalysis(); }} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12.5px] border" style={{ borderColor: 'var(--demo-border)', color: ascend.ink, fontWeight: 600 }}>
          <Sparkles size={13} /> Switch to Simulation
        </button>
      </div>
    </SectionCard>
  );
}
