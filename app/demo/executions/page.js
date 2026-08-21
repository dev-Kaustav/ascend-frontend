'use client';

import { useRouter } from 'next/navigation';
import { useDemo } from '../_components/DemoProvider';
import { SectionCard, StatusChip, OrchestratorBadge, DataSourceBadge } from '../_components/shared';
import { ascend } from '../_lib/theme';

export default function ExecutionsList() {
  const { executions } = useDemo();
  const router = useRouter();
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-[22px]" style={{ fontWeight: 720, color: ascend.ink, letterSpacing: '-0.02em' }}>Agent Executions</h1>
        <p className="text-[13px] mt-0.5" style={{ color: ascend.muted }}>Analysis runs created during this browser session</p>
      </div>
      <SectionCard>
        {executions.length === 0 ? (
          <div className="py-10 text-center text-[13px]" style={{ color: ascend.muted }}>
            No executions yet. Open a retailer and run the AI agent to create one.
          </div>
        ) : (
          <div className="flex flex-col">
            {executions.map((e) => (
              <div key={e.executionId} onClick={() => router.push(`/demo/executions/${e.executionId}`)}
                className="flex items-center justify-between gap-3 py-3 border-b last:border-0 cursor-pointer hover:bg-black/[0.015]" style={{ borderColor: 'var(--demo-border)' }}>
                <div className="min-w-0">
                  <div className="text-[13px]" style={{ fontWeight: 600, color: ascend.ink }}>{e.retailerName}</div>
                  <div className="text-[11.5px]" style={{ color: ascend.muted }}>{e.executionId} · {e.whenLabel}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <OrchestratorBadge orchestrator={e.orchestrator} />
                  <DataSourceBadge dataSource={e.dataSource} />
                  <StatusChip status={e.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
