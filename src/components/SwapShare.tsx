"use client";
import { useMemo, useState } from "react";
import { canNativeShare, serializeSwapLink, type SwapLinkState } from "@/lib/swapLink";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import QrCode from "@/components/QrCode";

export function SwapShare({ state }: { state: SwapLinkState }) {
  const { copy } = useCopyToClipboard();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const link = useMemo(() => serializeSwapLink(state), [state]);
  // Checked at render time so the Share button only appears where the native share sheet exists.
  const nativeShare = canNativeShare();

  const share = async () => {
    try {
      await navigator.share({ url: link });
    } catch {
      // Cancelling the share sheet (AbortError) or a failed share is not an error here:
      // the copy and QR fallback below stays visible, and no toast is shown.
    }
  };

  return <div><button type="button" onClick={() => setOpen((value) => !value)}>Share swap</button>{open && <div role="dialog" className="rounded border p-3">{nativeShare && <button type="button" onClick={share}>Share</button>}<button type="button" onClick={async () => setCopied(await copy(link))}>{copied ? "Copied" : "Copy link"}</button><QrCode value={link} label="QR code for this swap" size={160} /><code className="block max-w-xs break-all text-xs">{link}</code></div>}</div>;
}
