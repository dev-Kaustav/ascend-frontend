"use client";

import { useEffect, useMemo, useState } from "react";
import { apiEndpoints, apiFetchCached } from "@/lib/api";
import { normalizeAccessRules } from "@/lib/accessRules";

export default function useAccessRules({ ttl = 60000 } = {}) {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    apiFetchCached(apiEndpoints.auth.accessRules, { ttl })
      .then((data) => {
        if (!active) return;
        setRules(normalizeAccessRules(data || []));
        setError("");
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        setRules([]);
        setError(err?.message || "Unable to load access rules.");
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [ttl]);

  const rulesByPath = useMemo(() => rules, [rules]);

  return { rules: rulesByPath, loading, error };
}
