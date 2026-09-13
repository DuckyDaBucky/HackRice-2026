import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { clerkEnabled } from "@/lib/clerk";
import { SignUp } from "@clerk/nextjs";

export default async function SignUpPage() {
  if (!clerkEnabled) return <p className="p-8">Sign-in is unavailable until Clerk is configured.</p>;

  const { userId } = await auth();
  if (userId) redirect("/");

  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignUp />
    </div>
  );
}
