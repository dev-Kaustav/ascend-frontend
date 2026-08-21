'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { useDemo } from '../../_components/DemoProvider';
import { SectionCard, ProvenanceBadges } from '../../_components/shared';
import { AgentTrace, AnalysisFacts, SkuSignals } from '../../_components/WorkflowPieces';
import { ascend } from '../../_lib/theme';

export default function ExecutionDetail() {
  const params = useParams();
  const executionId = params?.executionId ?? '';
  const { getExecution } = useDemo();
  const exec = getExecution(executionId);

  return (
    <div className="flex flex-col gap-4">
      <Link href="/demo/executions" className="inline-flex items-center gap-1.5 text-[12.5px]" style={{ color: ascend.muted }}>
        <ArrowLeft size={14} /> Agent Executions
      </Link>
      {!exec ? (
        <SectionCard title="Execution not available">
          <p className="text-[13px]" style={{ color: ascend.muted }}>This execution is not in the current session. Run the agent again to create one.</p>
        </SectionCard>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-[20px]" style={{ fontWeight: 720, color: ascend.ink }}>{exec.retailer?.retailerName ?? 'Execution'}</h1>
              <p className="text-[12px] mt-0.5" style={{ color: ascend.muted }}>{exec.executionId}</p>
            </div>
            <ProvenanceBadges orchestrator={exec.orchestrator} dataSource={exec.dataSource} />
          </div>
          {exec.analysisFacts && <SectionCard title="Analysis facts"><AnalysisFacts facts={exec.analysisFacts} /></SectionCard>}
          {exec.skuSignals?.length ? <SectionCard title="Reorder signals"><SkuSignals signals={exec.skuSignals} /></SectionCard> : null}
          {exec.trace?.length ? <SectionCard title="Workflow execution trace"><AgentTrace trace={exec.trace} /></SectionCard> : null}
        </>
      )}
    </div>
  );
}
