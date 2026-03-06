"use client";

import { useState } from "react";

type Plan = {
  id: string;
  name: string;
  priceCents: number;
  billingKind: "SUBSCRIPTION" | "ONE_TIME";
  billingInterval: "DAY" | "WEEK" | "MONTH" | "YEAR" | null;
  usageKind: "UNLIMITED" | "LIMITED_CREDITS";
  creditsPerPeriod: number | null;
  creditsPeriodUnit: "DAY" | "WEEK" | "MONTH" | "YEAR" | "NONE" | null;
};

type Props = {
  plans: Plan[];
  gymSlug: string;
  memberId: string;
  pickPlanAction: (formData: FormData) => void;
  /** When false, hides the "no active plan" warning banner. Default true. */
  showWarning?: boolean;
};

export function MemberPlanChooser({
  plans,
  gymSlug,
  memberId,
  pickPlanAction,
  showWarning = true,
}: Props) {
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      {showWarning && (
        <div
          className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs text-amber-200"
          role="alert"
        >
          You do not have an active plan, please choose a plan to be able to sign
          up for classes.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
        {plans.map((plan) => {
          const isSelected = selectedPlanId === plan.id;

          return (
            <div
              key={plan.id}
              className="flex flex-col gap-2 border border-white/15 rounded-xl p-4 bg-black/40 min-h-[180px] cursor-pointer"
              role="button"
              tabIndex={0}
              onClick={() =>
                setSelectedPlanId((prev) => (prev === plan.id ? null : plan.id))
              }
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelectedPlanId((prev) =>
                    prev === plan.id ? null : plan.id,
                  );
                }
              }}
            >
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <span className="font-medium">{plan.name}</span>
              </div>

              <div className="mt-1 space-y-0.5 text-[11px] text-white/60">
                <div>
                  {plan.billingKind === "ONE_TIME"
                    ? "One-time"
                    : plan.billingInterval === "DAY"
                    ? "Daily subscription"
                    : plan.billingInterval === "WEEK"
                    ? "Weekly subscription"
                    : plan.billingInterval === "YEAR"
                    ? "Yearly subscription"
                    : "Monthly subscription"}
                </div>
                <div>
                  {plan.usageKind === "UNLIMITED"
                    ? "Unlimited"
                    : plan.creditsPerPeriod != null &&
                      plan.creditsPeriodUnit != null
                    ? (() => {
                        const unit =
                          plan.creditsPeriodUnit === "DAY"
                            ? "day"
                            : plan.creditsPeriodUnit === "WEEK"
                            ? "week"
                            : plan.creditsPeriodUnit === "MONTH"
                            ? "month"
                            : plan.creditsPeriodUnit === "YEAR"
                            ? "year"
                            : "total";
                        if (plan.creditsPeriodUnit === "NONE") {
                          return `${plan.creditsPerPeriod} classes total`;
                        }
                        return `${plan.creditsPerPeriod} classes/${unit}`;
                      })()
                    : "Limited credits"}
                </div>
                <div>€{(plan.priceCents / 100).toFixed(2)}</div>
              </div>

              {isSelected && (
                <div
                  className="mt-3 border-t border-white/10 pt-2 space-y-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <p className="text-[11px] text-white/80">
                    Do you want to pick the {plan.name}?
                  </p>
                  <form
                    action={pickPlanAction}
                    className="flex items-center gap-2 text-[11px]"
                  >
                    <input type="hidden" name="gymSlug" value={gymSlug} />
                    <input type="hidden" name="memberId" value={memberId} />
                    <input type="hidden" name="planId" value={plan.id} />
                    <button
                      type="submit"
                      className="inline-flex items-center justify-center px-3 py-1 rounded-md bg-orange-600 font-medium hover:bg-orange-500 transition-colors"
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedPlanId(null);
                      }}
                      className="text-white/60 hover:text-white"
                    >
                      Cancel
                    </button>
                  </form>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

