"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { CartItem } from "@/lib/cart-storage";
import * as store from "./cart-store";

type CartContextValue = {
  /** Empty until hydrated (also on the server), so markup always matches. */
  items: CartItem[];
  /** Sum of quantities; 0 until hydrated. */
  itemCount: number;
  isHydrated: boolean;
  /** Returns "capped" when the line hit the 10 max, "full" when a 21st distinct line was refused. */
  addItem: (variantId: string, quantity: number) => "added" | "capped" | "full";
  setQuantity: (variantId: string, quantity: number) => void;
  removeItem: (variantId: string) => void;
  clear: () => void;
  isDrawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

const subscribeNever = () => () => {};

export function CartProvider({ children }: { children: ReactNode }) {
  const items = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  const isHydrated = useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
  const [isDrawerOpen, setDrawerOpen] = useState(false);
  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
      isHydrated,
      addItem: store.addItem,
      setQuantity: store.setQuantity,
      removeItem: store.removeItem,
      clear: store.clear,
      isDrawerOpen,
      openDrawer,
      closeDrawer,
    }),
    [items, isHydrated, isDrawerOpen, openDrawer, closeDrawer],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}
