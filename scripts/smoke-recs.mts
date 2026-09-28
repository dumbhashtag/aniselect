import { recommendAnime } from "@/services/recommendationEngine";
import { getAnimeByIds } from "@/services/anilist";
// AoT S1, Death Note, Code Geass R1, Steins;Gate, FMA:B
const sets: Record<string, number[]> = {
  franchise: [16498, 1535, 1575, 9253, 5114],
  // Frieren, K-On!, Yuru Camp, Non Non Biyori, Aria the Animation
  cozy: [154587, 5680, 98444, 17549, 477],
};
for (const [name, ids] of Object.entries(sets)) {
  const picks = await getAnimeByIds(ids);
  for (const gems of [false, true]) {
    const recs = await recommendAnime(picks, { hiddenGems: gems });
    console.log(`\n== ${name} gems=${gems}:`, picks.map((p) => p.title).join(" | "));
    for (const r of recs) {
      console.log(`  ${r.matchPercentage}% ${r.anime.title} [${r.anime.format} ${r.anime.year}] pop=${r.anime.popularity} franchise=${r.isFranchiseEntry}`);
      console.log("     -", r.reasons.join("\n     - "));
    }
  }
}
