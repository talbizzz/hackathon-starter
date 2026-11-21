import "server-only";
import type { PaidPlanContent } from "@/lib/paid-plan";

// Original editorial itinerary. Never import this module into a Client Component.
// Venue facts checked against the linked official visitor pages on 21 Nov 2026.
export const paidPlanContent: PaidPlanContent = {
  title: "Sunday art & local stories",
  introduction: "A self-guided afternoon for two to four adults who enjoy neighbourhood history and art. Start near Kottbusser Tor and finish with modern art. The museum stops are indoors; the transfer is outdoors. Suggested visit lengths and the walking allowance are editorial estimates, not live routing or reservations.",
  checkedAt: "21 November 2026",
  budget: "Allow €14 admission per adult at the regular rate, plus the €3.99 plan purchase once for your group. For two adults that is €31.99 before food, drinks and transport; for four it is €59.99. Reduced admission may apply with proof. Check current prices before visiting.",
  steps: [
    {
      time: "14:00–15:00",
      title: "Begin with Kreuzberg's stories at FHXB",
      detail: "Meet at Adalbertstraße 95A and enter the courtyard. Spend about an hour exploring the district museum. Choose a story that surprises each of you and compare it before leaving. Published Sunday hours are 10:00–20:00. The museum reports a broken lift: this route is not suitable as a step-free itinerary. Groups of ten or more must contact the museum beforehand.",
      cost: "Free admission",
      address: "Adalbertstraße 95A, 10999 Berlin",
      mapUrl: "https://www.google.com/maps/search/?api=1&query=FHXB+Museum+Adalbertstrasse+95A+Berlin",
      sourceUrl: "https://www.fhxb-museum.de/besuch/besuch-planen",
    },
    {
      time: "15:00–15:40",
      title: "Make your way to the gallery",
      detail: "Use the walking directions from FHXB to Berlinische Galerie. We have allowed 40 minutes for walking and a short pause; this is a planning buffer, not a verified live journey time. Check the route before leaving. If walking outside does not suit the weather or your group, use your preferred transport planner and account for its fare and current journey time.",
      cost: "Walking: no fare. Other transport extra.",
      mapUrl: "https://www.google.com/maps/dir/?api=1&origin=FHXB+Museum+Adalbertstrasse+95A+Berlin&destination=Berlinische+Galerie+Alte+Jakobstrasse+124+Berlin&travelmode=walking",
    },
    {
      time: "15:40–17:00",
      title: "Finish with art at Berlinische Galerie",
      detail: "Explore at your own pace and pick one work each to discuss. The gallery publishes Sunday hours of 10:00–18:00 and regular admission of €14, reduced €7. This itinerary does not reserve admission. Check the visitor page and ticket availability before starting; if the gallery cannot accommodate you, use the alternative below instead of assuming entry is guaranteed.",
      cost: "€14 per adult at the published regular rate",
      address: "Alte Jakobstraße 124–128, 10969 Berlin",
      mapUrl: "https://www.google.com/maps/search/?api=1&query=Berlinische+Galerie+Alte+Jakobstrasse+124+Berlin",
      sourceUrl: "https://berlinischegalerie.de/besuch/",
    },
  ],
  backup: {
    title: "Keep it free and shorter",
    detail: "If paid gallery admission is unavailable or exceeds your budget, keep this as a 90–120 minute FHXB visit instead. Its published Sunday closing time is 20:00, so the suggested afternoon fits without a second venue booking. If FHXB is closed or its lift issue prevents your visit, do not use this alternative: check the gallery directly and plan a single-venue visit. The shorter option is not a substitute for step-free access.",
    sourceUrl: "https://www.fhxb-museum.de/besuch/besuch-planen",
  },
  notes: [
    "This is an English-language digital guide, not an admission ticket, tour guide or booking service. Opening hours, prices and access conditions can change; recheck the official sources before travel.",
    "For Sunday 22 November, the suggested start is 14:00. For another Sunday, verify the calendar, exhibitions and opening exceptions first. Nothing here confirms real-time capacity.",
    "Museum entries, transport, meals and drinks are paid separately. No café or restaurant availability is included.",
    "You may copy this purchased itinerary to the friends joining your outing. Keep account credentials private. Return to this page with the same account to recover your purchase.",
  ],
};
