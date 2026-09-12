import { clerkEnabled } from "@/lib/clerk";
import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  if (!clerkEnabled) return <p className="p-8">Sign-in is unavailable until Clerk is configured.</p>;
  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignUp />
    </div>
  );
}
