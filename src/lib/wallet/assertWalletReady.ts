import { evaluateOrigin, getTrustedOrigins } from "@/lib/config";
import { useWalletStore } from "@/store/wallet";

export class UntrustedOriginError extends Error {
  constructor(hostname: string) {
    super(
      `Signing is not allowed on untrusted origin "${hostname}". Please visit the canonical site to continue.`,
    );
    this.name = "UntrustedOriginError";
  }
}

/**
 * Throws `UntrustedOriginError` unless the current origin is trusted. Cheap and
 * synchronous: call it again immediately before `signTransaction` to close the
 * gap between the precondition check and the actual signing call.
 */
export function checkOriginTrusted(): void {
  const hostname = window.location.hostname;
  const protocol = window.location.protocol.replace(":", "");
  if (evaluateOrigin(hostname, protocol, getTrustedOrigins()) === "untrusted") {
    throw new UntrustedOriginError(hostname);
  }
}

/**
 * Precondition check before any wallet signing operation.
 *
 * Verifies that:
 *  1. The wallet is connected and has an address.
 *  2. The current origin is on the trusted list.
 *
 * Throws `UntrustedOriginError` when the origin is not trusted,
 * and a generic `Error` when the wallet is not connected.
 */
export function assertWalletReady(): { address: string; network: string } {
  const state = useWalletStore.getState();

  if (!state.isConnected || !state.address) {
    throw new Error(state.error ?? "Connect a wallet to continue.");
  }

  checkOriginTrusted();

  return { address: state.address, network: state.network ?? "" };
}
