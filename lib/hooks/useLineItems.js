"use client";

import { useCallback, useState } from "react";

export default function useLineItems(createEmptyItem) {
  const [items, setItems] = useState([createEmptyItem()]);

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
    setItems([createEmptyItem()]);
  }, [createEmptyItem]);

  return {
    items,
    setItems,
    updateItem,
    addItem,
    removeItem,
    resetItems
  };
}
