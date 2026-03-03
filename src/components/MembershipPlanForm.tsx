"use client";

import { useState } from "react";

type Props = {
  gymId: string;
  gymSlug: string;
  action: (formData: FormData) => void;
};

export function MembershipPlanForm({ gymId, gymSlug, action }: Props) {
  const [open, setOpen] = useState(false);

  if (!open) {
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
        className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end"
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
          <label htmlFor="duration" className="text-xs font-medium">
            Duration
          </label>
          <select
            id="duration"
            name="duration"
            required
            className="px-3 py-2 rounded-md bg-black/40 border border-white/15 focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm"
            defaultValue="month"
          >
            <option value="single_day">Single day</option>
            <option value="week">Week</option>
            <option value="month">Month</option>
            <option value="year">Year</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="classLimit" className="text-xs font-medium">
            Class limit (per month)
          </label>
          <select
            id="classLimit"
            name="classLimit"
            required
            className="px-3 py-2 rounded-md bg-black/40 border border-white/15 focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm"
            defaultValue="unlimited"
          >
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="unlimited">Unlimited</option>
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
        onClick={() => setOpen(false)}
        className="text-xs text-white/60 hover:text-white"
      >
        Cancel
      </button>
    </div>
  );
}
