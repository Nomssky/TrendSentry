// Public landing (W1): Obsidian & Lime marketing site.
// Read-only: stats come from the static backtest reference only — no DB access.

import { BentoFeatures } from "./components/marketing/BentoFeatures";
import { Hero } from "./components/marketing/Hero";
import { Methodology } from "./components/marketing/Methodology";
import { PricingTeaser } from "./components/marketing/PricingTeaser";
import { SiteShell } from "./components/marketing/SiteShell";

export default function Home() {
  return (
    <SiteShell>
      <main>
        <Hero />
        <BentoFeatures />
        <Methodology />
        <PricingTeaser />
      </main>
    </SiteShell>
  );
}
