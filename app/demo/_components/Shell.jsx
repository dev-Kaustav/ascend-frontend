'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Toaster } from 'sonner';
import { Activity, ArrowRight, Eye, EyeOff, GitBranch, LayoutDashboard, Lock, Package, RotateCcw, Store } from 'lucide-react';
import { DemoProvider, useDemo } from './DemoProvider';
import { AscendLogo } from './shared';
import { STAGE_LABEL } from '../_lib/stateMachine';
import { ascend } from '../_lib/theme';

// SHA-256 of the demo password. Default: "ascend2026".
// To change: printf 'NEWPASS' | shasum -a 256  → paste hex below.
const PASSWORD_HASH = '2cea7c6ee7a07e578c181a698825227deed1b67cd95621913758be064a328ca8';
const AUTH_KEY = 'ascend_demo_auth';

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

const NAV = [
  { href: '/demo', label: 'Command Centre', icon: LayoutDashboard, exact: true },
  { href: '/demo/retailers', label: 'Retailer Intelligence', icon: Store },
  { href: '/demo/executions', label: 'Agent Executions', icon: Activity },
  { href: '/demo/orders', label: 'Orders', icon: Package },
  { href: '/demo/workflow', label: 'Workflow Architecture', icon: GitBranch },
];

function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden md:flex md:w-[230px] shrink-0 flex-col justify-between" style={{ background: ascend.carbon, color: ascend.cream }}>
      <div>
        <div className="px-5 py-5"><AscendLogo /></div>
        <nav className="px-3 mt-2 flex flex-col gap-0.5">
          {NAV.map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href);
            return (
              <Link key={href} href={href} className="group flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition-colors"
                style={{ background: active ? 'rgba(200,255,61,0.12)' : 'transparent', color: active ? ascend.lime : 'rgba(244,241,232,0.72)', fontWeight: active ? 600 : 500 }}>
                <Icon size={16} /> {label}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="px-5 py-4" style={{ color: 'rgba(244,241,232,0.4)', fontSize: 10.5, letterSpacing: '0.04em' }}>
        Investor demo · 4-hour replenishment
      </div>
    </aside>
  );
}

function ControlBar() {
  const { mode, setMode, stage, retailer, reset, busy } = useDemo();
  const router = useRouter();
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-2.5 border-b" style={{ borderColor: 'var(--demo-border)', background: 'rgba(255,253,248,0.85)', backdropFilter: 'blur(6px)' }}>
      <div className="flex items-center gap-3 min-w-0">
        <span className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[10.5px] uppercase tracking-wider"
          style={{ background: mode === 'live' ? 'rgba(233,113,50,0.14)' : 'rgba(91,100,112,0.12)', color: mode === 'live' ? ascend.orange : '#5b6470', fontWeight: 700 }}>
          <span className="rounded-full" style={{ width: 6, height: 6, background: mode === 'live' ? ascend.orange : '#5b6470' }} />
          {mode === 'live' ? 'Live' : 'Simulation'}
        </span>
        <span className="hidden sm:inline text-[12px] truncate" style={{ color: ascend.muted }}>{retailer ? retailer.name : 'No retailer selected'}</span>
        <span className="hidden lg:inline text-[11px] rounded-md px-2 py-0.5" style={{ background: ascend.limeWash, color: ascend.limeDark, fontWeight: 600 }}>{STAGE_LABEL[stage]}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="hidden md:inline text-[11px]" style={{ color: ascend.metal }}>{mode === 'live' ? 'Connected via /api → n8n' : 'Local deterministic fixtures'}</span>
        <div className="flex rounded-lg p-0.5" style={{ background: ascend.paper }}>
          {['simulation', 'live'].map((m) => (
            <button key={m} onClick={() => setMode(m)} disabled={busy} className="px-2.5 py-1 rounded-md text-[11.5px] capitalize transition-colors disabled:opacity-50"
              style={{ background: mode === m ? ascend.carbon : 'transparent', color: mode === m ? ascend.cream : ascend.muted, fontWeight: 600 }}>{m}</button>
          ))}
        </div>
        <button onClick={() => { reset(); router.push('/demo'); }} disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] border transition-colors disabled:opacity-50" style={{ borderColor: 'var(--demo-border)', color: ascend.ink, fontWeight: 600 }}>
          <RotateCcw size={13} /> Reset
        </button>
      </div>
    </div>
  );
}

function LoginGate({ onLogin }) {
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!password.trim()) { setError('Enter the demo password.'); return; }
    setLoading(true);
    const hex = await sha256Hex(password);
    if (hex === PASSWORD_HASH) {
      try { localStorage.setItem(AUTH_KEY, JSON.stringify({ ts: Date.now() })); } catch {}
      onLogin();
    } else { setError('Incorrect password.'); setLoading(false); }
  };

  return (
    <div className="ascend-demo min-h-screen flex" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div className="hidden lg:flex lg:w-[520px] flex-col justify-between p-12" style={{ background: ascend.carbon }}>
        <AscendLogo />
        <div>
          <h1 className="text-[38px] leading-[1.1]" style={{ color: ascend.cream, fontWeight: 700, letterSpacing: '-0.02em' }}>
            The next order is<br /><span style={{ color: ascend.lime }}>already in the data.</span>
          </h1>
          <p className="mt-5 text-[14px] max-w-[330px]" style={{ color: ascend.metal, lineHeight: 1.7 }}>
            AI detects likely replenishment, drafts the basket, you approve — and the retailer is nudged on WhatsApp for 4-hour delivery.
          </p>
        </div>
        <span className="text-[11px]" style={{ color: 'rgba(244,241,232,0.4)' }}>Investor demo · simulation-safe</span>
      </div>
      <div className="flex-1 flex items-center justify-center px-6" style={{ background: ascend.cream }}>
        <div className="w-full max-w-[400px]">
          <div className="rounded-2xl p-8" style={{ background: ascend.warmWhite, boxShadow: '0 8px 32px rgba(0,0,0,0.06)', border: '1px solid rgba(0,0,0,0.05)' }}>
            <div className="grid place-items-center rounded-xl mb-5" style={{ width: 40, height: 40, background: ascend.limeWash }}>
              <Lock size={18} style={{ color: ascend.limeDark }} />
            </div>
            <h2 className="text-[20px]" style={{ color: ascend.ink, fontWeight: 650 }}>Protected demo</h2>
            <p className="text-[13px] mt-1 mb-6" style={{ color: ascend.muted }}>Enter the password to view the Ascend Foods demo.</p>
            <form onSubmit={submit} className="space-y-4">
              <div className="relative">
                <input type={show ? 'text' : 'password'} value={password} autoFocus
                  onChange={(e) => { setPassword(e.target.value); setError(''); }} placeholder="Demo password"
                  className="w-full h-12 px-4 pr-11 rounded-xl text-[14px] outline-none border" style={{ background: '#f7f6f1', borderColor: error ? ascend.riskHigh : 'transparent', color: ascend.ink }} />
                <button type="button" onClick={() => setShow(!show)} className="absolute right-3.5 top-1/2 -translate-y-1/2" style={{ color: ascend.metal }}>
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {error && <div className="text-[12.5px] rounded-lg px-3 py-2" style={{ color: ascend.riskHigh, background: 'rgba(192,52,29,0.08)' }}>{error}</div>}
              <button type="submit" disabled={loading} className="w-full h-12 rounded-xl flex items-center justify-center gap-2 text-[14px] disabled:opacity-70" style={{ background: ascend.lime, color: ascend.carbon, fontWeight: 700 }}>
                {loading ? 'Checking…' : <>Enter demo <ArrowRight size={16} /></>}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DemoShell({ children }) {
  const [authed, setAuthed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try { setAuthed(localStorage.getItem(AUTH_KEY) !== null); } catch {}
    setReady(true);
  }, []);

  if (!ready) return <div style={{ minHeight: '100vh', background: ascend.cream }} />;
  if (!authed) return <LoginGate onLogin={() => setAuthed(true)} />;

  return (
    <DemoProvider>
      <div className="ascend-demo flex h-screen" style={{ background: ascend.cream, color: ascend.ink }}>
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 h-screen">
          <ControlBar />
          <main className="flex-1 overflow-y-auto">
            <div className="max-w-[1180px] mx-auto px-5 sm:px-7 py-6">{children}</div>
          </main>
        </div>
        <Toaster position="bottom-right" />
      </div>
    </DemoProvider>
  );
}
