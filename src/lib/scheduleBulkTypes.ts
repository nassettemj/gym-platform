import type { ClassMainCategory, ClassSubCategory } from "@prisma/client";

export type BulkClassUpdatePayload = {
  classIds: string[];
  operation?: "update" | "delete";
  instructor?: {
    kind: "set" | "clear";
    instructorId?: string;
  };
  mainCategory?: {
    kind: "set" | "clear";
    value?: ClassMainCategory;
  };
  subCategory?: {
    kind: "set" | "clear";
    value?: ClassSubCategory;
  };
};

