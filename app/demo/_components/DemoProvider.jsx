'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { runAnalyse, AgentError } from '../_lib/client';
import { newExecutionId } from '../_lib/idempotency';
import { stageFromStatus } from '../_lib/stateMachine';
import { AS_OF_DATE } from '../_data/orderHistory';
import { RETAILER_BY_ID } from '../_data/retailers';

const DEFAULT_OUTLET = 'RET-1027';
const DemoContext = createContext(null);

export function DemoProvider({ children }) {
  const [state, setState] = useState(() => ({
    mode: 'simulation',
    stage: 'READY',
    retailer: RETAILER_BY_ID[DEFAULT_OUTLET] ?? null,
    analysis: null,
    basket: [],
    error: null,
    busy: false,
    executions: [], // session-only, most recent first
  }));

  const stateRef = useRef(state);
  stateRef.current = state;

  const patch = useCallback((p) => setState((s) => ({ ...s, ...p })), []);
  const setMode = useCallback((mode) => patch({ mode }), [patch]);

  const reset = useCallback(() => {
    setState((s) => ({ ...s, stage: 'READY', analysis: null, basket: [], error: null, busy: false }));
  }, []);

  const selectRetailer = useCallback((id) => {
    const r = RETAILER_BY_ID[id] ?? null;
    setState((s) => ({ ...s, retailer: r, stage: 'READY', analysis: null, basket: [], error: null }));
  }, []);

  const runAnalysis = useCallback(async () => {
    const cur = stateRef.current;
    if (!cur.retailer || cur.busy) return;
    setState((s) => ({ ...s, busy: true, error: null, stage: 'ANALYSING' }));
    const executionId = newExecutionId();
    try {
      const resp = await runAnalyse({
        event: 'ANALYSE_REORDER_OPPORTUNITIES',
        mode: cur.mode,
        executionId,
        outletId: cur.retailer.outletId,
        asOfDate: AS_OF_DATE,
      });
      const wrapper = {
        executionId: resp.executionId ?? executionId,
        retailerName: resp.retailer?.retailerName ?? cur.retailer.name,
        status: resp.status,
        orchestrator: resp.orchestrator,
        dataSource: resp.dataSource,
        whenLabel: 'Just now',
        response: resp,
      };
      setState((s) => ({
        ...s,
        busy: false,
        analysis: resp,
        basket: (resp.basket?.items ?? []).map((i) => ({ ...i })),
        stage: stageFromStatus(resp.status),
        executions: [wrapper, ...s.executions].slice(0, 20),
      }));
    } catch (e) {
      const msg = e instanceof AgentError ? e.message : 'Analysis failed.';
      setState((s) => ({ ...s, busy: false, error: msg, stage: 'ERROR' }));
    }
  }, []);

  const setQuantity = useCallback((skuCode, qty) => {
    setState((s) => ({
      ...s,
      basket: s.basket.map((i) =>
        i.skuCode === skuCode
          ? { ...i, quantity: Math.max(1, qty), lineValue: Math.round(i.retailerPrice * Math.max(1, qty)) }
          : i,
      ),
    }));
  }, []);

  const approve = useCallback(() => {
    setState((s) => (s.stage === 'AWAITING_HUMAN_APPROVAL' || s.stage === 'RECOMMENDATION_READY' ? { ...s, stage: 'APPROVED' } : s));
  }, []);

  const getExecution = useCallback((id) => stateRef.current.executions.find((e) => e.executionId === id)?.response, []);

  const value = useMemo(() => {
    const basketValue = state.basket.reduce((sum, i) => sum + i.lineValue, 0);
    return {
      ...state,
      basketValue,
      recommendation: state.analysis?.recommendation ?? null,
      setMode, selectRetailer, runAnalysis, setQuantity, approve, reset, getExecution,
    };
  }, [state, setMode, selectRetailer, runAnalysis, setQuantity, approve, reset, getExecution]);

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemo() {
  const ctx = useContext(DemoContext);
  if (!ctx) throw new Error('useDemo must be used within DemoProvider');
  return ctx;
}
