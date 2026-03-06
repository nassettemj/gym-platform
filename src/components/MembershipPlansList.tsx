"use client";

import { useState } from "react";
import Link from "next/link";

type Plan = {
  id: string;
  name: string;
  priceCents: number;
  durationDays: number;
  maxCheckInsPerMonth: number | null;
  billingKind: "SUBSCRIPTION" | "PASS";
  duration: "ONE_MONTH" | "ONE_YEAR";
  age: "ADULTS" | "KIDS_AND_JUNIORS";
  visits: "ONE_VISIT" | "TEN_VISITS" | null;
};

type Props = {
  gymSlug: string;
  gymId: string;
  plans: Plan[];
  createAction: (formData: FormData) => void;
  updateAction: (formData: FormData) => void;
  deleteAction: (formData: FormData) => void;
};

export function MembershipPlansList({
  gymSlug,
  gymId: _gymId,
  plans,
  createAction: _createAction,
  updateAction,
  deleteAction,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFormBillingKind, setEditFormBillingKind] = useState<"SUBSCRIPTION" | "PASS">("SUBSCRIPTION");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState("");

  function startEditing(plan: Plan) {
    setDeletingId(null);
    setConfirmText("");
    setEditingId(plan.id);
    setEditFormBillingKind(plan.billingKind);
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
      {plans.map((plan) => {
        const isEditing = editingId === plan.id;
        const isDeleting = deletingId === plan.id;

        if (isEditing) {
          const price = (plan.priceCents / 100).toFixed(2);

          return (
            <div
              key={plan.id}
              className="border border-white/15 rounded-xl p-4 space-y-2 bg-black/40 min-h-[180px]"
            >
              <form
                action={updateAction}
                className="grid grid-cols-1 gap-3 items-end"
              >
                <input type="hidden" name="planId" value={plan.id} />
                <input type="hidden" name="gymSlug" value={gymSlug} />

                <div className="flex flex-col gap-1">
                  <label htmlFor={`name-${plan.id}`} className="text-xs font-medium">
                    Name of the plan
                  </label>
                  <input
                    id={`name-${plan.id}`}
                    name="name"
                    defaultValue={plan.name}
                    required
                    className="px-3 py-2 rounded-md bg-black/40 border border-white/15 focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label
                    htmlFor={`billingKind-${plan.id}`}
                    className="text-xs font-medium"
                  >
                    Plan type
                  </label>
                  <select
                    id={`billingKind-${plan.id}`}
                    name="billingKind"
                    value={editFormBillingKind}
                    onChange={(e) => setEditFormBillingKind(e.target.value as "SUBSCRIPTION" | "PASS")}
                    required
                    className="px-3 py-2 rounded-md bg-black/40 border border-white/15 focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm"
                  >
                    <option value="SUBSCRIPTION">Subscription</option>
                    <option value="PASS">Pass</option>
                  </select>
                </div>

                {editFormBillingKind === "SUBSCRIPTION" ? (
                  <>
                    <div className="flex flex-col gap-1">
                      <label
                        htmlFor={`duration-${plan.id}`}
                        className="text-xs font-medium"
                      >
                        Duration
                      </label>
                      <select
                        id={`duration-${plan.id}`}
                        name="duration"
                        defaultValue={plan.duration}
                        required
                        className="px-3 py-2 rounded-md bg-black/40 border border-white/15 focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm"
                      >
                        <option value="ONE_MONTH">1 month</option>
                        <option value="ONE_YEAR">1 year</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label
                        htmlFor={`age-${plan.id}`}
                        className="text-xs font-medium"
                      >
                        Age
                      </label>
                      <select
                        id={`age-${plan.id}`}
                        name="age"
                        defaultValue={plan.age}
                        required
                        className="px-3 py-2 rounded-md bg-black/40 border border-white/15 focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm"
                      >
                        <option value="ADULTS">Adults</option>
                        <option value="KIDS_AND_JUNIORS">Kids & Juniors</option>
                      </select>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col gap-1">
                    <label
                      htmlFor={`visits-${plan.id}`}
                      className="text-xs font-medium"
                    >
                      Visits
                    </label>
                    <select
                      id={`visits-${plan.id}`}
                      name="visits"
                      defaultValue={plan.visits ?? "ONE_VISIT"}
                      required
                      className="px-3 py-2 rounded-md bg-black/40 border border-white/15 focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm"
                    >
                      <option value="ONE_VISIT">1 visit</option>
                      <option value="TEN_VISITS">10 visits</option>
                    </select>
                  </div>
                )}

                <div className="flex flex-col gap-1">
                  <label
                    htmlFor={`price-${plan.id}`}
                    className="text-xs font-medium"
                  >
                    Price
                  </label>
                  <input
                    id={`price-${plan.id}`}
                    name="price"
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue={price}
                    required
                    className="px-3 py-2 rounded-md bg-black/40 border border-white/15 focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm"
                  />
                </div>

                <button
                  type="submit"
                  className="inline-flex items-center justify-center px-4 py-2 rounded-md bg-orange-600 text-xs font-medium hover:bg-orange-500 transition-colors md:mt-4"
                >
                  Save
                </button>
              </form>
              <button
                type="button"
                onClick={() => setEditingId(null)}
                className="text-xs text-white/60 hover:text-white"
              >
                Cancel
              </button>

              {/* Delete controls only available while editing */}
              {isDeleting ? (
                <form
                  action={deleteAction}
                  className="mt-2 flex flex-col gap-2 text-xs"
                >
                  <input type="hidden" name="planId" value={plan.id} />
                  <input type="hidden" name="gymSlug" value={gymSlug} />
                  <p className="text-white/70">
                    Type <span className="font-semibold">delete</span> to confirm removal of this plan.
                  </p>
                  <div className="flex gap-2 items-center">
                    <input
                      type="text"
                      name="confirm"
                      value={confirmText}
                      onChange={(e) => setConfirmText(e.target.value)}
                      className="px-2 py-1 rounded-md bg-black/40 border border-white/20 focus:outline-none focus:ring-1 focus:ring-red-500 text-xs"
                    />
                    <button
                      type="submit"
                      disabled={confirmText !== "delete"}
                      className="inline-flex items-center justify-center px-3 py-1 rounded-md bg-red-600 text-[11px] font-medium hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Confirm delete
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDeletingId(null);
                        setConfirmText("");
                      }}
                      className="text-white/60 hover:text-white"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setDeletingId(plan.id);
                    setConfirmText("");
                  }}
                  className="mt-2 text-xs text-red-400 hover:text-red-300"
                >
                  Delete plan
                </button>
              )}
            </div>
          );
        }

        return (
          <div
            key={plan.id}
            className="flex flex-col gap-2 border border-white/15 rounded-xl p-4 bg-black/40 cursor-pointer min-h-[180px]"
            role="button"
            tabIndex={0}
            onClick={() => startEditing(plan)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                startEditing(plan);
              }
            }}
          >
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <span className="font-medium">{plan.name}</span>
            </div>

            {/* Plan details stacked vertically */}
            <div className="mt-1 space-y-0.5 text-xs text-white/60">
              <div>
                {plan.billingKind === "PASS" ? "Pass" : "Subscription"}
              </div>
              <div>
                {plan.billingKind === "PASS"
                  ? plan.visits === "TEN_VISITS"
                    ? "10 visits"
                    : "1 visit"
                  : `${plan.duration === "ONE_YEAR" ? "1 year" : "1 month"} · ${plan.age === "KIDS_AND_JUNIORS" ? "Kids & Juniors" : "Adults"}`}
              </div>
              <div>€{(plan.priceCents / 100).toFixed(2)}</div>
            </div>
          </div>
        );
      })}

      <Link
        href={`/${gymSlug}/admin/plans/new`}
        className="flex flex-col items-center justify-center border border-transparent rounded-xl p-4 bg-orange-600 text-black hover:bg-orange-500 transition-colors text-sm font-semibold text-center min-h-[180px]"
      >
        Create plan
      </Link>
    </div>
  );
}
