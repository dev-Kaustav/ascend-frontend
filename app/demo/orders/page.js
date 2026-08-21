'use client';

import { Package } from 'lucide-react';
import { SectionCard } from '../_components/shared';
import { ascend } from '../_lib/theme';

export default function OrdersScreen() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-[22px]" style={{ fontWeight: 720, color: ascend.ink, letterSpacing: '-0.02em' }}>Orders</h1>
        <p className="text-[13px] mt-0.5" style={{ color: ascend.muted }}>Confirmed reorders from the demo workflow</p>
      </div>
      <SectionCard>
        <div className="py-12 flex flex-col items-center text-center gap-2">
          <span className="grid place-items-center rounded-full" style={{ width: 40, height: 40, background: ascend.paper }}>
            <Package size={18} style={{ color: ascend.metal }} />
          </span>
          <p className="text-[13px]" style={{ color: ascend.ink, fontWeight: 600 }}>No orders have been created through this demo workflow yet.</p>
          <p className="text-[12px] max-w-[420px]" style={{ color: ascend.muted }}>
            The workflow currently stops at human approval. Order creation will appear here once the outbound
            workflow (WhatsApp send → retailer reply → order) is connected.
          </p>
        </div>
      </SectionCard>
    </div>
  );
}
