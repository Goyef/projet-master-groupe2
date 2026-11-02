import Link from "next/link";
import Reservation from "@/components/portal/Reservation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
export default function BookingPage() {
  return (
    <section className="mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2">
      <div className="space-y-6">
        <Badge variant="secondary">Rendez-vous prospects</Badge>
        <h1 className="text-5xl font-semibold">Parlons de votre projet</h1>
        <p className="text-lg text-muted-foreground">
          Un appel de vente pour découvrir votre besoin, ou un audit séminaire
          pour explorer votre projet. Chaque rendez-vous dure 45 minutes et est
          confirmé automatiquement.
        </p>
        <p className="text-muted-foreground">
          L’audit est ouvert aux prospects et aux clients signés. Les séances de
          suivi sont réservées aux clients connectés.
        </p>
        <Button
          variant="outline"
          render={<Link href="/connexion" />}
          nativeButton={false}
        >
          Déjà client ? Accéder à mon espace
        </Button>
        <p className="text-sm text-muted-foreground">
          Les modalités, les tarifs et les conditions d’annulation seront
          précisés par le gérant. Aucun paiement en ligne n’est demandé.
        </p>
      </div>
      <div className="portal-ui min-w-0">
        <Reservation />
      </div>
    </section>
  );
}
