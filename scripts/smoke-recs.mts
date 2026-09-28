import { recommendAnime } from "@/services/recommendationEngine";
import { searchAnime } from "@/services/anilist";
const sets = [
  ["Hunter x Hunter 2011", "Jujutsu Kaisen", "Chainsaw Man", "Frieren", "Mob Psycho 100"],
  ["Clannad After Story", "Toradora", "Your Lie in April", "Anohana", "Violet Evergarden"],
  ["Steins;Gate", "Steins;Gate 0", "Death Note", "Code Geass", "Monster"],
];
for (const set of sets) {
  const picks = [];
  for (const q of set) picks.push((await searchAnime(q, 1))[0]);
  const t = Date.now();
  const recs = await recommendAnime(picks, process.argv[2] === "gems" ? { hiddenGems: true } : {});
  console.log("\n==", picks.map((p) => p.title).join(" | "), Date.now() - t, "ms");
  for (const r of recs) {
    console.log(`  ${r.matchPercentage}% (${r.score}) ${r.anime.title} [${r.anime.format} ${r.anime.year}] pop=${r.anime.popularity}`);
    console.log("    ", JSON.stringify(r.signals));
    for (const reason of r.reasons) console.log("     -", reason);
  }
}
