import { Navbar } from "./components/Navbar";
import { Hero } from "./components/Hero";
import { SocialProof } from "./components/SocialProof";
import { Problem } from "./components/Problem";
import { Stats } from "./components/Stats";
import { Features } from "./components/Features";
import { HowItWorks } from "./components/HowItWorks";
import { LiveRatings } from "./components/LiveRatings";
import { Differentiator } from "./components/Differentiator";
import { Beta } from "./components/Beta";
import { FAQ } from "./components/FAQ";
import { FinalCTA } from "./components/FinalCTA";
import { Footer } from "./components/Footer";

export default function HomePage() {
  return (
    <main className="relative overflow-x-hidden bg-black">
      <Navbar />
      <Hero />
      <SocialProof />
      <Problem />
      <Stats />
      <Features />
      <HowItWorks />
      <LiveRatings />
      <Differentiator />
      <Beta />
      <FAQ />
      <FinalCTA />
      <Footer />
    </main>
  );
}
