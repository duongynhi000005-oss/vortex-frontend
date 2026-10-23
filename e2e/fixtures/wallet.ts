import type { Page } from "@playwright/test";

export const DEFAULT_PUBLIC_KEY = "GDEMOE2ESMOKETESTPUBLICKEY000000000000000000000";

export type FreighterNetwork = "TESTNET" | "PUBLIC";

// approve: sign and return XDR. reject: return a user-rejected error.
// timeout: never answer, so the app's own timeout path is what gets exercised.
export type SigningOutcome = "approve" | "reject" | "timeout";

export interface FreighterState {
  publicKey: string;
  network: FreighterNetwork;
  signing: SigningOutcome;
}

// Freighter talks to the page over window.postMessage, not a `window.freighter`
// object with methods — this shims that bridge so the app's real
// @stellar/freighter-api calls resolve without the browser extension installed.
// State lives on `window.__freighterMock` so tests can switch account, network
// or signing outcome mid-flow with `setFreighterState`. It is reset on every
// navigation because the init script re-runs.
export async function mockFreighter(page: Page, overrides: Partial<FreighterState> = {}) {
  const initial: FreighterState = {
    publicKey: DEFAULT_PUBLIC_KEY,
    network: "TESTNET",
    signing: "approve",
    ...overrides,
  };

  await page.addInitScript((initial: FreighterState) => {
    const mock = window as unknown as { freighter: boolean; __freighterMock: FreighterState };
    mock.freighter = true;
    mock.__freighterMock = initial;

    window.addEventListener("message", (event: MessageEvent) => {
      const data = event.data;
      if (event.source !== window || !data || data.source !== "FREIGHTER_EXTERNAL_MSG_REQUEST") {
        return;
      }

      const state = mock.__freighterMock;
      const respond = (fields: Record<string, unknown>) => {
        window.postMessage(
          { source: "FREIGHTER_EXTERNAL_MSG_RESPONSE", messagedId: data.messageId, ...fields },
          "*"
        );
      };

      switch (data.type) {
        case "REQUEST_ACCESS":
        case "REQUEST_PUBLIC_KEY":
          respond({ publicKey: state.publicKey, error: "" });
          break;
        case "REQUEST_NETWORK":
          respond({ network: state.network, error: "" });
          break;
        case "REQUEST_ALLOWED_STATUS":
          respond({ isAllowed: true });
          break;
        case "SUBMIT_TRANSACTION":
          if (state.signing === "approve") {
            respond({ signedTransaction: "signed-xdr-e2e-mock", error: "" });
          } else if (state.signing === "reject") {
            respond({ signedTransaction: "", error: "User rejected the request" });
          }
          break;
      }
    });
  }, initial);
}

export async function setFreighterState(page: Page, patch: Partial<FreighterState>) {
  await page.evaluate((patch: Partial<FreighterState>) => {
    Object.assign((window as unknown as { __freighterMock: FreighterState }).__freighterMock, patch);
  }, patch);
}
