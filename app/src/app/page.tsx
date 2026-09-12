import { EmployerShowcase } from "@/components/marketing/EmployerShowcase";
import { Hero } from "@/components/marketing/Hero";
import { HowItWorks } from "@/components/marketing/HowItWorks";
import { TrustSection } from "@/components/marketing/TrustSection";
import { TwoAudienceCards } from "@/components/marketing/TwoAudienceCards";
import { WaitlistCta } from "@/components/marketing/WaitlistCta";

export default function Home() {
  return (
    <>
      <Hero />
      <TwoAudienceCards />
      <EmployerShowcase />
      <TrustSection />
      <HowItWorks />
      <WaitlistCta />
    </>
  );
}
