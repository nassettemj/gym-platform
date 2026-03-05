"use client";

import { useState } from "react";

type Member = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  birthDate: Date | null;
  belt: string | null;
  stripes: number | null;
  status: string;
};

type Props = {
  member: Member;
  gymSlug: string;
  updateAction: (formData: FormData) => void;
  deleteAction?: (formData: FormData) => void;
  /** When true, show delete member button (platform or gym admin only). */
  canDeleteMember?: boolean;
  /** When true, show edit controls for name and email (platform or gym admin only). */
  canEditProfile?: boolean;
  /** Optional validation error for profile fields (birthday / phone / email). */
  profileError?: string | null;
};

type EditingField =
  | "name"
  | "email"
  | "phone"
  | "birthDate"
  | null;

export function MemberProfilePanel({
  member,
  gymSlug,
  updateAction,
  deleteAction,
  canDeleteMember,
  canEditProfile,
  profileError,
}: Props) {
  const [editingField, setEditingField] = useState<EditingField>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const birthDateStr = member.birthDate
    ? new Date(member.birthDate).toISOString().slice(0, 10)
    : "";

  const fullName = `${member.firstName} ${member.lastName}`.trim();

  return (
    <div className="space-y-2 text-sm">
      {/* Profile-wide validation error */}
      {profileError && (
        <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
          {profileError}
        </p>
      )}

      {/* Name */}
      <div className="flex items-center justify-between gap-3">
        {editingField === "name" && canEditProfile ? (
          <form
            action={updateAction}
            className="flex flex-wrap items-center gap-2 flex-1"
          >
            <input type="hidden" name="gymSlug" value={gymSlug} />
            <input type="hidden" name="memberId" value={member.id} />
            <div className="flex flex-col gap-1 flex-1 min-w-[8rem]">
              <label className="text-xs font-medium text-white/80">
                First name
              </label>
              <input
                name="firstName"
                defaultValue={member.firstName}
                className="px-2 py-1 rounded-md bg-black/40 border border-white/20 text-xs focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>
            <div className="flex flex-col gap-1 flex-1 min-w-[8rem]">
              <label className="text-xs font-medium text-white/80">
                Last name
              </label>
              <input
                name="lastName"
                defaultValue={member.lastName}
                className="px-2 py-1 rounded-md bg-black/40 border border-white/20 text-xs focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingField(null)}
                className="px-2 py-1.5 rounded-md border border-white/20 text-[11px] hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-2 py-1.5 rounded-md bg-orange-600 text-[11px] font-medium hover:bg-orange-500"
              >
                Save
              </button>
            </div>
          </form>
        ) : (
          <>
            <p className="text-white/80">
              <span className="font-semibold">Name:</span> {fullName}
            </p>
            {canEditProfile && (
              <button
                type="button"
                onClick={() => setEditingField("name")}
                className="text-xs text-white/70 hover:text-white"
                aria-label="Edit name"
              >
                ✎
              </button>
            )}
          </>
        )}
      </div>

      {/* Date of birth */}
      <div className="flex items-center justify-between gap-3">
        {editingField === "birthDate" ? (
          <form
            action={updateAction}
            className="flex items-center gap-2 flex-1"
          >
            <input type="hidden" name="gymSlug" value={gymSlug} />
            <input type="hidden" name="memberId" value={member.id} />
            <div className="flex flex-col gap-1 flex-1">
              <label className="text-xs font-medium text-white/80">
                Birthday
              </label>
              <input
                name="birthDate"
                type="date"
                defaultValue={birthDateStr}
                className="px-2 py-1 rounded-md bg-black/40 border border-white/20 text-xs focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>
            <div className="flex items-center gap-2 pt-4">
              <button
                type="button"
                onClick={() => setEditingField(null)}
                className="px-2 py-1.5 rounded-md border border-white/20 text-[11px] hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-2 py-1.5 rounded-md bg-orange-600 text-[11px] font-medium hover:bg-orange-500"
              >
                Save
              </button>
            </div>
          </form>
        ) : (
          <>
            <p className="text-white/80">
              <span className="font-semibold">Birthday:</span>{" "}
              {birthDateStr || "—"}
            </p>
            <button
              type="button"
              onClick={() => setEditingField("birthDate")}
              className="text-xs text-white/70 hover:text-white"
              aria-label="Edit date of birth"
            >
              ✎
            </button>
          </>
        )}
      </div>

      {/* Phone */}
      <div className="flex items-center justify-between gap-3">
        {editingField === "phone" ? (
          <form
            action={updateAction}
            className="flex items-center gap-2 flex-1"
          >
            <input type="hidden" name="gymSlug" value={gymSlug} />
            <input type="hidden" name="memberId" value={member.id} />
            <div className="flex flex-col gap-1 flex-1">
              <label className="text-xs font-medium text-white/80">
                Phone
              </label>
              <input
                name="phone"
                defaultValue={member.phone ?? ""}
                className="px-2 py-1 rounded-md bg-black/40 border border-white/20 text-xs focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>
            <div className="flex items-center gap-2 pt-4">
              <button
                type="button"
                onClick={() => setEditingField(null)}
                className="px-2 py-1.5 rounded-md border border-white/20 text-[11px] hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-2 py-1.5 rounded-md bg-orange-600 text-[11px] font-medium hover:bg-orange-500"
              >
                Save
              </button>
            </div>
          </form>
        ) : (
          <>
            <p className="text-white/80 flex items-center gap-1">
              <span aria-hidden="true">📞</span>
              {member.phone ?? "—"}
            </p>
            <button
              type="button"
              onClick={() => setEditingField("phone")}
              className="text-xs text-white/70 hover:text-white"
              aria-label="Edit phone"
            >
              ✎
            </button>
          </>
        )}
      </div>

      {/* Email */}
      <div className="flex items-center justify-between gap-3">
        {editingField === "email" && canEditProfile ? (
          <form
            action={updateAction}
            className="flex items-center gap-2 flex-1"
          >
            <input type="hidden" name="gymSlug" value={gymSlug} />
            <input type="hidden" name="memberId" value={member.id} />
            <div className="flex flex-col gap-1 flex-1">
              <label className="text-xs font-medium text-white/80">
                Email
              </label>
              <input
                name="email"
                defaultValue={member.email ?? ""}
                type="email"
                className="px-2 py-1 rounded-md bg-black/40 border border-white/20 text-xs focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>
            <div className="flex items-center gap-2 pt-4">
              <button
                type="button"
                onClick={() => setEditingField(null)}
                className="px-2 py-1.5 rounded-md border border-white/20 text-[11px] hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-2 py-1.5 rounded-md bg-orange-600 text-[11px] font-medium hover:bg-orange-500"
              >
                Save
              </button>
            </div>
          </form>
        ) : (
          <>
            <p className="text-white/80 flex items-center gap-1">
              <span aria-hidden="true">✉️</span>
              {/* Always show email from member record (Prisma); never from session or other source */}
              {member.email ?? "—"}
            </p>
            {canEditProfile && (
              <button
                type="button"
                onClick={() => setEditingField("email")}
                className="text-xs text-white/70 hover:text-white"
                aria-label="Edit email"
              >
                ✎
              </button>
            )}
          </>
        )}
      </div>

      {/* Danger zone: delete member (only for platform/gym admins) */}
      {deleteAction && canDeleteMember && (
        <div className="mt-4 pt-3 border-t border-red-900/60 space-y-2">
          {!showDeleteConfirm ? (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="inline-flex items-center justify-center px-3 py-1.5 rounded-md bg-red-600 text-[11px] font-medium hover:bg-red-500"
            >
              Delete member
            </button>
          ) : (
            <>
              <p className="text-xs text-red-300">
                Deleting this member will permanently remove their profile and any
                associated login account. This action cannot be undone.
              </p>
              <form
                action={deleteAction}
                className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-3"
              >
                <input type="hidden" name="gymSlug" value={gymSlug} />
                <input type="hidden" name="memberId" value={member.id} />
                <label className="flex-1 flex flex-col gap-1 text-xs text-red-200">
                  Type DELETE to confirm
                  <input
                    name="confirm"
                    type="text"
                    placeholder="DELETE"
                    className="px-2 py-1 rounded-md bg-black/60 border border-red-500/50 text-xs focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(false)}
                    className="inline-flex items-center justify-center px-3 py-1.5 rounded-md border border-white/20 text-[11px] hover:bg-white/10"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center px-3 py-1.5 rounded-md bg-red-600 text-[11px] font-medium hover:bg-red-500"
                  >
                    Confirm delete
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      )}
    </div>
  );
}
