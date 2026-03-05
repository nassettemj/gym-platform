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
            className="px-3 py-2 rounded-md bg-black/40 border border-white/15 focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm"
            defaultValue="SUBSCRIPTION"
          >
            <option value="SUBSCRIPTION">Subscription</option>
            <option value="ONE_TIME">Single purchase</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="billingInterval" className="text-xs font-medium">
            Billing interval
          </label>
          <select
            id="billingInterval"
            name="billingInterval"
            required
            className="px-3 py-2 rounded-md bg-black/40 border border-white/15 focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm"
            defaultValue="MONTH"
          >
            <option value="DAY">Day</option>
            <option value="WEEK">Week</option>
            <option value="MONTH">Month</option>
            <option value="YEAR">Year</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="usageKind" className="text-xs font-medium">
            Usage type
          </label>
          <select
            id="usageKind"
            name="usageKind"
            required
            className="px-3 py-2 rounded-md bg-black/40 border border-white/15 focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm"
            defaultValue="UNLIMITED"
          >
            <option value="UNLIMITED">Unlimited</option>
            <option value="LIMITED_CREDITS">Limited credits</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="creditsPerPeriod" className="text-xs font-medium">
            Credits (if limited)
          </label>
          <input
            id="creditsPerPeriod"
            name="creditsPerPeriod"
            type="number"
            min="1"
            className="px-3 py-2 rounded-md bg-black/40 border border-white/15 focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm"
            placeholder="e.g. 3"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="creditsPeriodUnit" className="text-xs font-medium">
            Credits period
          </label>
          <select
            id="creditsPeriodUnit"
            name="creditsPeriodUnit"
            className="px-3 py-2 rounded-md bg-black/40 border border-white/15 focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm"
            defaultValue="WEEK"
          >
            <option value="DAY">Per day</option>
            <option value="WEEK">Per week</option>
            <option value="MONTH">Per month</option>
            <option value="YEAR">Per year</option>
            <option value="NONE">Total (no reset)</option>
          </select>
        </div>

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
