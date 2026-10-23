"use client";

import { useSolvers } from "@/hooks/useSolvers";
import { getParameterImpactHandler, type ParameterImpactHandler } from "@/lib/governanceImpact";
import type { GovernanceProposal, ParameterChange } from "@/lib/governanceStore";
import { useTranslation } from "@/lib/i18n/I18nProvider";

/**
 * Concrete "who would this affect" preview for a proposal. A parameter gets a
 * preview only when `PARAMETER_IMPACT_REGISTRY` has a handler for it; every
 * other proposal says so instead of guessing.
 */
export function ProposalImpactPreview({ proposal }: { proposal: GovernanceProposal }) {
  const { t } = useTranslation();
  const change = proposal.parameterChange;
  const handler = change ? getParameterImpactHandler(change.parameter) : undefined;

  return (
    <section aria-labelledby="impact-heading" className="pt-4 border-t border-vx-line space-y-1.5">
      <h3 id="impact-heading" className="text-xs font-semibold text-vx-text">
        {t("governance.impact.title")}
      </h3>
      {change && handler ? (
        <ImpactSummary change={change} handler={handler} />
      ) : (
        <p className="text-xs text-vx-muted">{t("governance.impact.unavailable")}</p>
      )}
    </section>
  );
}

export function BondImpact({ currentValue, proposedValue }: { currentValue: number; proposedValue: number }) {
  const handler = getParameterImpactHandler("minSolverBondUsd");
  if (!handler) return null;
  return (
    <ImpactSummary
      change={{ parameter: "minSolverBondUsd", currentValue, proposedValue }}
      handler={handler}
    />
  );
}

function ImpactSummary({ change, handler }: { change: ParameterChange; handler: ParameterImpactHandler }) {
  const { t } = useTranslation();
  const { solvers, isLoading, error } = useSolvers();

  if (isLoading) return <p className="text-xs text-vx-muted">{t("governance.impact.loading")}</p>;
  if (error) return <p className="text-xs text-vx-muted">{t("governance.impact.error")}</p>;
  if (solvers.length === 0) return <p className="text-xs text-vx-muted">{t("governance.impact.noSolvers")}</p>;

  const impact = handler(change, solvers);
  const values = {
    current: change.currentValue,
    proposed: impact.proposedValue,
    total: impact.total,
    lose: impact.wouldLose,
    gain: impact.wouldGain,
  };

  let message: string;
  if (impact.direction === "raise") {
    message =
      impact.wouldLose === 0
        ? t("governance.impact.raiseNoneAffected", values)
        : t("governance.impact.raise", values);
  } else if (impact.direction === "lower") {
    message =
      impact.wouldGain === 0
        ? t("governance.impact.lower", values)
        : t("governance.impact.lowerWithGain", values);
  } else {
    message = t("governance.impact.unchanged", values);
  }

  return (
    <>
      <p className="text-xs sm:text-sm text-vx-text">{message}</p>
      <p className="text-[11px] text-vx-dim">{t("governance.impact.basis", { total: impact.total })}</p>
    </>
  );
}
