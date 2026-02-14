"use client";

import { useCallback, useState } from "react";

export default function useLineItems(createEmptyItem, initialCount = 1) {
  const resolvedInitialCount = Math.max(1, Number(initialCount) || 1);
  const [items, setItems] = useState(() =>
    Array.from({ length: resolvedInitialCount }, () => createEmptyItem())
  );

  const updateItem = useCallback((index, patch) => {
    setItems((prev) => prev.map((item, idx) => (idx === index ? { ...item, ...patch } : item)));
  }, []);

  const addItem = useCallback(() => {
    setItems((prev) => [...prev, createEmptyItem()]);
  }, [createEmptyItem]);

  const removeItem = useCallback((index) => {
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  }, []);

  const resetItems = useCallback(() => {
    setItems(() => Array.from({ length: resolvedInitialCount }, () => createEmptyItem()));
  }, [createEmptyItem, resolvedInitialCount]);

  return {
    items,
    setItems,
    updateItem,
    addItem,
    removeItem,
    resetItems
  };
}
