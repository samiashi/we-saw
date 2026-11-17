import { useContext } from "react";
import { StoreContext, type WeSawStore } from "@/lib/store/context";

export function useStore(): WeSawStore {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useStore must be used inside StoreProvider");
  return store;
}
