import { Footer } from "@/components/Footer";
import { HomeClient } from "@/components/HomeClient";
import { Navbar } from "@/components/Navbar";
import { PosterWall } from "@/components/PosterWall";
import { getTrending } from "@/services/animeService";
import type { Anime } from "@/types/anime";

export const dynamic = "force-dynamic";

export default async function Home() {
  let trending: Anime[] = [];
  try {
    trending = await getTrending(16);
  } catch {
    // The hero works without its backdrop; never block the page on it.
  }

  return (
    <>
      <Navbar />
      <main className="flex-1">
        <HomeClient hero={<PosterWall anime={trending} />} />
      </main>
      <Footer />
    </>
  );
}
