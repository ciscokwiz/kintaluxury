"use client";

import { useEffect, useSyncExternalStore } from "react";
import { PRODUCTS } from "./products";

export interface CartLine {
  productId: string;
  size: string;
  quantity: number;
}

interface CartSnapshot {
  lines: CartLine[];
  hydrated: boolean;
}

const STORAGE_KEY = "kinta-bag-v1";
const serverSnapshot: CartSnapshot = { lines: [], hydrated: false };
let snapshot = serverSnapshot;
let initialized = false;
const listeners = new Set<() => void>();
const quantityInRange = (quantity: number) => Math.min(10, Math.max(1, Math.floor(quantity) || 1));

function sanitize(value: unknown): CartLine[] {
  if (!Array.isArray(value)) return [];
  const result: CartLine[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const { productId, size, quantity } = item as Partial<CartLine>;
    const product = PRODUCTS.find((entry) => entry.id === productId);
    if (!product || typeof size !== "string" || !product.sizes.some((option) => option === size) || typeof quantity !== "number" || !Number.isFinite(quantity)) continue;
    const existing = result.find((line) => line.productId === productId && line.size === size);
    if (existing) existing.quantity = quantityInRange(existing.quantity + quantity);
    else result.push({ productId: product.id, size, quantity: quantityInRange(quantity) });
  }
  return result;
}

function readStorage(): CartLine[] {
  try {
    return sanitize(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]"));
  } catch {
    return [];
  }
}

function publish(lines: CartLine[], save = true) {
  snapshot = { lines, hydrated: true };
  if (save) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      // The bag still works in memory when browser storage is unavailable.
    }
  }
  listeners.forEach((listener) => listener());
}

function initialize() {
  if (initialized) return;
  initialized = true;
  publish(readStorage(), false);
  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY || event.key === null) publish(readStorage(), false);
  });
}

export function addToCart(productId: string, size: string, quantity: number) {
  initialize();
  const before = snapshot.lines.find((line) => line.productId === productId && line.size === size)?.quantity ?? 0;
  const lines = sanitize([...snapshot.lines, { productId, size, quantity }]);
  const after = lines.find((line) => line.productId === productId && line.size === size)?.quantity ?? 0;
  publish(lines);
  return { added: after - before, quantity: after };
}

export function updateCartQuantity(productId: string, size: string, quantity: number) {
  initialize();
  publish(snapshot.lines.map((line) => line.productId === productId && line.size === size ? { ...line, quantity: quantityInRange(quantity) } : line));
}

export function removeFromCart(productId: string, size: string) {
  initialize();
  publish(snapshot.lines.filter((line) => line.productId !== productId || line.size !== size));
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useCart() {
  const state = useSyncExternalStore(subscribe, () => snapshot, () => serverSnapshot);
  useEffect(initialize, []);
  return { ...state, count: state.lines.reduce((sum, line) => sum + line.quantity, 0) };
}
