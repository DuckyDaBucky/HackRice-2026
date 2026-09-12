import { Hero } from "@/components/marketing/Hero";
import { HowItWorks } from "@/components/marketing/HowItWorks";
import { TrustSection } from "@/components/marketing/TrustSection";
import { WaitlistCta } from "@/components/marketing/WaitlistCta";
import { Workspaces } from "@/components/marketing/Workspaces";

export default function Home() {
  return (
    <>
      <Hero />
      <HowItWorks />
      <Workspaces />
      <TrustSection />
      <WaitlistCta />
    </>
  );
}
