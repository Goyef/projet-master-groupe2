import Header from "@/components/Header";
import Hero from "@/components/Hero";
import Values from "@/components/Values";
import Approach from "@/components/Approach";
import Services from "@/components/Services";
import Booking from "@/components/Booking";
import Faq from "@/components/Faq";
import Closing from "@/components/Closing";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <>
      <div className="demo">
        PROJET SCOLAIRE · Textes proposés à valider par le gérant · Utiliser des
        données de test
      </div>
      <Header />
      <main>
        <Hero />
        <Values />
        <Approach />
        <Services />
        <Booking />
        <Faq />
        <Closing />
      </main>
      <Footer />
    </>
  );
}
