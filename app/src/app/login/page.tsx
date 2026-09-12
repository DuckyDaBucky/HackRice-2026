import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function LoginRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_url?: string }>;
}) {
  const { userId } = await auth();
  const { redirect_url: redirectUrl } = await searchParams;
  if (userId) {
    redirect(redirectUrl && redirectUrl.startsWith("/") ? redirectUrl : "/");
  }
  redirect(redirectUrl ? `/sign-in?redirect_url=${encodeURIComponent(redirectUrl)}` : "/sign-in");
}
