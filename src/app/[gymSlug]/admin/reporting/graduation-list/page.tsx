import { redirect } from "next/navigation";

interface GraduationListRedirectProps {
  params: Promise<{ gymSlug: string }>;
}

export default async function GraduationListRedirectPage({ params }: GraduationListRedirectProps) {
  const { gymSlug } = await params;
  redirect(`/${gymSlug}/admin/members/graduation-list`);
}
