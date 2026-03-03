"use client";

import { useState } from "react";

type Plan = {
  id: string;
  name: string;
  priceCents: number;
  durationDays: number;
  maxCheckInsPerMonth: number | null;
};

type Props = {
  gymSlug: string;
  plans: Plan[];
  updateAction: (formData: FormData) => void;
  deleteAction: (formData: FormData) => void;
};

function durationKeyFromDays(days: number): string {
  switch (days) {
    case 1:
      return "single_day";
    case 7:
      return "week";
    case 30:
      return "month";
    case 365:
      return "year";
    default:
      return "month";
  }
}

function classLimitKey(value: number | null): string {
  if (value == null) return "unlimited";
  if (value === 1 || value === 2 || value === 3) return String(value);
  return "unlimited";
}

export function MembershipPlansList({
  gymSlug,
  plans,
  updateAction,
  deleteAction,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState("");

  return (
    <ul className="space-y-2 text-sm">
      {plans.map((plan) => {
        const isEditing = editingId === plan.id;
        const isDeleting = deletingId === plan.id;

        if (isEditing) {
          const price = (plan.priceCents / 100).toFixed(2);
          const durationKey = durationKeyFromDays(plan.durationDays);
          const limitKey = classLimitKey(plan.maxCheckInsPerMonth);

          return (
            <li
              key={plan.id}
              className="border border-white/15 rounded-md p-3 space-y-2"
            >
              <form
                action={updateAction}
                className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end"
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
                    htmlFor={`duration-${plan.id}`}
                    className="text-xs font-medium"
                  >
                    Duration
                  </label>
                  <select
                    id={`duration-${plan.id}`}
                    name="duration"
                    defaultValue={durationKey}
                    required
                    className="px-3 py-2 rounded-md bg-black/40 border border-white/15 focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm"
                  >
                    <option value="single_day">Single day</option>
                    <option value="week">Week</option>
                    <option value="month">Month</option>
                    <option value="year">Year</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label
                    htmlFor={`classLimit-${plan.id}`}
                    className="text-xs font-medium"
                  >
                    Class limit (per month)
                  </label>
                  <select
                    id={`classLimit-${plan.id}`}
                    name="classLimit"
                    defaultValue={limitKey}
                    required
                    className="px-3 py-2 rounded-md bg-black/40 border border-white/15 focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm"
                  >
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                    <option value="unlimited">Unlimited</option>
                  </select>
                </div>

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
            </li>
          );
        }

        return (
          <li
            key={plan.id}
            className="flex flex-col gap-1 border border-white/15 rounded-md p-3"
          >
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <span className="font-medium">{plan.name}</span>
              <span className="text-xs text-white/60">
                {(() => {
                  const price = (plan.priceCents / 100).toFixed(2);
                  const durationLabel =
                    plan.durationDays === 1
                      ? "Single day"
                      : plan.durationDays === 7
                      ? "Week"
                      : plan.durationDays === 30
                      ? "Month"
                      : plan.durationDays === 365
                      ? "Year"
                      : `${plan.durationDays} days`;
                  const limitLabel =
                    plan.maxCheckInsPerMonth == null
                      ? "Unlimited classes"
                      : `${plan.maxCheckInsPerMonth} class(es)/month`;
                  return `${durationLabel} · ${limitLabel} · €${price}`;
                })()}
              </span>
            </div>
            <div className="flex gap-3 text-xs mt-1">
              <button
                type="button"
                onClick={() => {
                  setDeletingId(null);
                  setConfirmText("");
                  setEditingId(plan.id);
                }}
                className="text-orange-400 hover:text-orange-300"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setConfirmText("");
                  setDeletingId(
                    deletingId === plan.id ? null : plan.id
                  );
                }}
                className="text-red-400 hover:text-red-300"
              >
                Delete
              </button>
            </div>
            {isDeleting && (
              <form
                action={deleteAction}
                className="mt-2 flex flex-col gap-2 text-xs"
              >
                <input type="hidden" name="planId" value={plan.id} />
                <input type="hidden" name="gymSlug" value={gymSlug} />
                <p className="text-white/70">
                  Type <span className="font-semibold">delete</span> to
                  confirm removal of this plan.
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
            )}
          </li>
        );
      })}
    </ul>
  );
}
