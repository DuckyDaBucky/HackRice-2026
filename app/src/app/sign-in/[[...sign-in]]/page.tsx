import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { clerkEnabled } from "@/lib/clerk";
import { SignIn } from "@clerk/nextjs";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_url?: string }>;
}) {
  if (!clerkEnabled) return <p className="p-8">Sign-in is unavailable until Clerk is configured.</p>;

  const { userId } = await auth();
  if (userId) {
    const { redirect_url: redirectUrl } = await searchParams;
    redirect(redirectUrl && redirectUrl.startsWith("/") ? redirectUrl : "/");
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignIn />
    </div>
  );
}
