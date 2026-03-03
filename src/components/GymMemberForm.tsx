"use client";

import { useState } from "react";

type AdultOption = {
  id: string;
  name: string;
};

type Props = {
  gymId: string;
  gymSlug: string;
  adults: AdultOption[];
  action: (formData: FormData) => void;
};

export function GymMemberForm({ gymId, gymSlug, adults, action }: Props) {
  const [memberType, setMemberType] = useState<"ADULT" | "CHILD">("ADULT");
  const showParent = memberType === "CHILD" && adults.length > 0;

  return (
    <form
      action={action}
      className="grid grid-cols-1 md:grid-cols-8 gap-3 items-end"
    >
      <input type="hidden" name="gymId" value={gymId} />
      <input type="hidden" name="gymSlug" value={gymSlug} />

      <div className="flex flex-col gap-1">
        <label htmlFor="firstName" className="text-xs font-medium">
          First name
        </label>
        <input
          id="firstName"
          name="firstName"
          required
          className="px-3 py-2 rounded-md bg-black/40 border border-white/15 focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="lastName" className="text-xs font-medium">
          Last name
        </label>
        <input
          id="lastName"
          name="lastName"
          required
          className="px-3 py-2 rounded-md bg-black/40 border border-white/15 focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-xs font-medium">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          className="px-3 py-2 rounded-md bg-black/40 border border-white/15 focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="phone" className="text-xs font-medium">
          Phone
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          className="px-3 py-2 rounded-md bg-black/40 border border-white/15 focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="memberType" className="text-xs font-medium">
          Age
        </label>
        <select
          id="memberType"
          name="memberType"
          className="px-3 py-2 rounded-md bg-black/40 border border-white/15 focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm"
          defaultValue="ADULT"
          onChange={(e) =>
            setMemberType(e.target.value === "CHILD" ? "CHILD" : "ADULT")
          }
        >
          <option value="ADULT">Adult</option>
          <option value="CHILD">Child</option>
        </select>
      </div>

      {showParent && (
        <div className="flex flex-col gap-1">
          <label htmlFor="parentId" className="text-xs font-medium">
            Parent
          </label>
          <select
            id="parentId"
            name="parentId"
            className="px-3 py-2 rounded-md bg-black/40 border border-white/15 focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm"
            defaultValue=""
          >
            <option value="" disabled>
              Select adult
            </option>
            {adults.map((adult) => (
              <option key={adult.id} value={adult.id}>
                {adult.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {!showParent && (
        <div className="hidden md:block" aria-hidden="true" />
      )}

      <div className="flex items-center gap-2">
        <input
          id="isInstructor"
          name="isInstructor"
          type="checkbox"
          className="h-4 w-4 rounded border border-white/40 bg-black/40"
        />
        <label htmlFor="isInstructor" className="text-xs font-medium">
          Is instructor
        </label>
      </div>

      <button
        type="submit"
        className="inline-flex items-center justify-center px-4 py-2 rounded-md bg-orange-600 text-xs font-medium hover:bg-orange-500 transition-colors md:mt-4"
      >
        Add member
      </button>
    </form>
  );
}
