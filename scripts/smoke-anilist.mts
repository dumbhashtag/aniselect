import { searchAnime, getSeeds, discover, getRandomAnime, getRelations } from "@/services/anilist";
const t = Date.now();
const s = await searchAnime("frieren");
console.log("search", s.slice(0, 3).map((a) => `${a.title} ${a.format} ${a.year}`), Date.now() - t);
const seeds = await getSeeds([154587, 11061, 113415, 127230, 21]);
console.log("seeds", seeds.map((x) => `${x.anime.title}: recs=${x.recommendations.length} rels=${x.relations.length} tags=${x.anime.tags.slice(0,3).map(t=>t.name)}`), Date.now() - t);
const d = await discover([{ key: "a", tags: ["Shounen", "Super Power"] }, { key: "b", genres: ["Action"], tags: ["Iyashikei"] }]);
console.log("discover", Object.entries(d).map(([k, v]) => `${k}: ${v.length} ${v.slice(0,3).map(a=>a.title)}`));
const rel = await getRelations([21, 1535]);
console.log("rels", [...rel.entries()].map(([k,v])=>`${k}:${v.length}`));
for (const f of [{}, { genre: "Mecha", minScore: 80, formats: ["MOVIE" as const] }, {genre:"Sports", finishedOnly:true, yearFrom:1990, yearTo:1999}]) {
  const r = await getRandomAnime(f);
  console.log("random", JSON.stringify(f), r?.title, r?.year, r?.score, r?.format, Date.now() - t);
}
