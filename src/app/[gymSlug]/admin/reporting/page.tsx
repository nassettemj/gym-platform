import { redirect } from "next/navigation";

interface ReportingPageProps {
  params: Promise<{ gymSlug: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function ReportingPage({ params }: ReportingPageProps) {
  const { gymSlug } = await params;
  redirect(`/${gymSlug}/admin/members`);
}
