import { clerkEnabled } from "@/lib/clerk";
import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  if (!clerkEnabled) return <p className="p-8">Sign-in is unavailable until Clerk is configured.</p>;
  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignIn />
    </div>
  );
}
