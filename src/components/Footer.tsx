export function Footer() {
  return (
    <footer className="border-t border-white/5 px-4 py-10 sm:px-6">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 text-xs text-muted-foreground sm:flex-row">
        <p>
          <span className="font-heading font-semibold text-foreground">Ani Select</span> — anime discovery built on community data.
        </p>
        <p>
          Data from{" "}
          <a href="https://anilist.co" target="_blank" rel="noopener noreferrer" className="text-foreground/80 hover:text-primary">
            AniList
          </a>{" "}
          and{" "}
          <a href="https://myanimelist.net" target="_blank" rel="noopener noreferrer" className="text-foreground/80 hover:text-primary">
            MyAnimeList
          </a>{" "}
          (via{" "}
          <a href="https://jikan.moe" target="_blank" rel="noopener noreferrer" className="text-foreground/80 hover:text-primary">
            Jikan
          </a>
          ). Not affiliated with either.
        </p>
      </div>
    </footer>
  );
}
