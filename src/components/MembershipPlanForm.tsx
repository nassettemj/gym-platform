"use client";

import { useState } from "react";

type Props = {
  gymId: string;
  gymSlug: string;
  action: (formData: FormData) => void;
  forceOpen?: boolean;
  onClose?: () => void;
};

export function MembershipPlanForm({
  gymId,
  gymSlug,
  action,
  forceOpen,
  onClose,
}: Props) {
  const [open, setOpen] = useState(false);
  const [billingKind, setBillingKind] = useState<"SUBSCRIPTION" | "PASS">("SUBSCRIPTION");

  const isOpen = forceOpen ?? open;

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center px-4 py-2 rounded-md bg-orange-600 text-xs font-medium hover:bg-orange-500 transition-colors"
      >
        Create plan
      </button>
    );
  }

  return (
    <div className="space-y-3">
      <form
        action={action}
        className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end"
      >
        <input type="hidden" name="gymId" value={gymId} />
        <input type="hidden" name="gymSlug" value={gymSlug} />

        <div className="flex flex-col gap-1">
          <label htmlFor="name" className="text-xs font-medium">
            Name of the plan
          </label>
          <input
            id="name"
            name="name"
            required
            className="px-3 py-2 rounded-md bg-black/40 border border-white/15 focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm"
            placeholder="Monthly Unlimited"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="billingKind" className="text-xs font-medium">
            Plan type
          </label>
          <select
            id="billingKind"
            name="billingKind"
            required
            value={billingKind}
            onChange={(e) => setBillingKind(e.target.value as "SUBSCRIPTION" | "PASS")}
            className="px-3 py-2 rounded-md bg-black/40 border border-white/15 focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm"
          >
            <option value="SUBSCRIPTION">Subscription</option>
            <option value="PASS">Pass</option>
          </select>
        </div>

        {billingKind === "SUBSCRIPTION" ? (
          <>
            <div className="flex flex-col gap-1">
              <label htmlFor="duration" className="text-xs font-medium">
                Duration
              </label>
              <select
                id="duration"
                name="duration"
                required
                className="px-3 py-2 rounded-md bg-black/40 border border-white/15 focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm"
                defaultValue="ONE_MONTH"
              >
                <option value="ONE_MONTH">1 month</option>
                <option value="ONE_YEAR">1 year</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="age" className="text-xs font-medium">
                Age
              </label>
              <select
                id="age"
                name="age"
                required
                className="px-3 py-2 rounded-md bg-black/40 border border-white/15 focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm"
                defaultValue="ADULTS"
              >
                <option value="ADULTS">Adults</option>
                <option value="KIDS_AND_JUNIORS">Kids & Juniors</option>
              </select>
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-1">
            <label htmlFor="visits" className="text-xs font-medium">
              Visits
            </label>
            <select
              id="visits"
              name="visits"
              required
              className="px-3 py-2 rounded-md bg-black/40 border border-white/15 focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm"
              defaultValue="ONE_VISIT"
            >
              <option value="ONE_VISIT">1 visit</option>
              <option value="TEN_VISITS">10 visits</option>
            </select>
          </div>
        )}

        <div className="flex flex-col gap-1">
          <label htmlFor="price" className="text-xs font-medium">
            Price
          </label>
          <input
            id="price"
            name="price"
            type="number"
            step="0.01"
            min="0"
            required
            className="px-3 py-2 rounded-md bg-black/40 border border-white/15 focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm"
            placeholder="89.00"
          />
        </div>

        <button
          type="submit"
          className="inline-flex items-center justify-center px-4 py-2 rounded-md bg-orange-600 text-xs font-medium hover:bg-orange-500 transition-colors md:mt-4"
        >
          Save plan
        </button>
      </form>

      <button
        type="button"
        onClick={() => {
          if (forceOpen && onClose) {
            onClose();
          } else {
            setOpen(false);
          }
        }}
        className="text-xs text-white/60 hover:text-white"
      >
        Cancel
      </button>
    </div>
  );
}
