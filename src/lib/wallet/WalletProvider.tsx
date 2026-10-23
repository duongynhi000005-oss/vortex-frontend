"use client";

import { createContext, useContext, useMemo, useState } from "react";

export type WalletContextValue = {
  address: string | null;
  isConnected: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  setAddress: (address: string | null) => void;
};

const WalletContext = createContext<WalletContextValue>({
  address: null,
  isConnected: false,
  connect: async () => {},
  disconnect: () => {},
  setAddress: () => {},
});

export function WalletProvider({
  children,
  initialAddress = null,
}: {
  children?: React.ReactNode;
  initialAddress?: string | null;
}) {
  const [address, setAddress] = useState<string | null>(initialAddress);

  const value = useMemo(
    () => ({
      address,
      isConnected: address !== null,
      connect: async () => {},
      disconnect: () => setAddress(null),
      setAddress,
    }),
    [address],
  );

  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  );
}

export function useWallet(): WalletContextValue {
  return useContext(WalletContext);
}
