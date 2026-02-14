"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiEndpoints, apiFetchCached } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";

export default function usePermissions({ ttl = 60000 } = {}) {
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const token = getAccessToken();
    if (!token) {
      setPermissions([]);
      setLoading(false);
      return () => {
        active = false;
      };
    }
    apiFetchCached(apiEndpoints.auth.me, { ttl })
      .then((data) => {
        if (!active) return;
        setPermissions(data?.permissions || []);
        setError("");
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        setPermissions([]);
        setError(err?.message || "Unable to load permissions.");
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [ttl]);

  const permissionMap = useMemo(() => {
    const map = new Map();
    permissions.forEach((entry) => {
      map.set(entry.code, Boolean(entry.is_allowed));
    });
    return map;
  }, [permissions]);

  const hasPermission = useCallback((code) => permissionMap.get(code) ?? false, [permissionMap]);

  return { permissions, hasPermission, loading, error };
}
