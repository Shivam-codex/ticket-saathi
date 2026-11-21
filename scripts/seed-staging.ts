import { supabaseAdmin } from "../src/integrations/supabase/client.server";

if (process.env["APP_ENV"] !== "staging") throw new Error("Set APP_ENV=staging; never run seed against production");
const cities = [
  { city: "Pune", state: "MH", venue: "PassOn staging Pune Arena" },
  { city: "Mumbai", state: "MH", venue: "PassOn staging Mumbai Dome" },
  { city: "Delhi", state: "DL", venue: "PassOn staging Delhi Ground" },
  { city: "Bengaluru", state: "KA", venue: "PassOn staging Bengaluru Hall" },
];
const titles = ["IPL Fan Night", "Comedy Live", "Indie Music Evening", "Premier Football", "Blockbuster Premiere"];
for (const [cityIndex, item] of cities.entries()) {
  const existingVenue = await supabaseAdmin.from("venues").select("id").eq("name", item.venue).maybeSingle();
  const venue = existingVenue.data ?? (await supabaseAdmin.from("venues").insert({ name: item.venue, city: item.city, state_code: item.state }).select("id").single()).data;
  if (!venue) throw new Error(`Could not seed venue ${item.venue}`);
  for (let index = 0; index < titles.length; index += 1) {
    const title = `PassOn staging ${item.city} ${titles[index]}`;
    const existing = await supabaseAdmin.from("events").select("id").eq("title", title).maybeSingle();
    if (existing.data) continue;
    const startsAt = new Date(Date.now() + (cityIndex * titles.length + index + 2) * 86_400_000);
    const { error } = await supabaseAdmin.from("events").insert({
      title, category: index === 0 || index === 3 ? "sports" : index === 4 ? "movie" : "concert", venue_id: venue.id,
      organizer: "PassOn staging organiser", description: "Isolated staging fixture; not a real event.",
      starts_at: startsAt.toISOString(), ends_at: new Date(startsAt.getTime() + 3 * 3_600_000).toISOString(),
      face_value_tiers: [{ name: "General", price_paise: 50_000 + index * 25_000 }], is_resellable: true, soft_launch_allowed: true,
    });
    if (error) throw error;
  }
}
console.log("Seeded 20 isolated staging events without duplicating existing fixtures.");
