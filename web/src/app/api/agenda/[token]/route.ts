import { NextRequest } from "next/server";

import { texts } from "@/content/texts";
import { feedEvents, isFeedToken, siteUrl } from "@/lib/agenda";
import { toIcs } from "@/lib/calendar";

// Flux d'abonnement iCalendar du gérant (Google Agenda, Apple Calendar, Outlook…).
// L'URL contient un jeton secret (CALENDAR_FEED_TOKEN) : sans lui, la page n'existe pas.
export async function GET(request: NextRequest, ctx: RouteContext<"/api/agenda/[token]">) {
  const { token } = await ctx.params;
  if (!isFeedToken(token)) return new Response("Introuvable", { status: 404 });
  return new Response(toIcs(await feedEvents(siteUrl(request.nextUrl.origin)), texts.calendar.feedName), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="synego.ics"',
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
