/**
 * ENOS Newsroom Registry
 * Category definitions and default RSS feeds for Games, Anime, Movies, and Music.
 */

const NEWSROOM_CATEGORIES = [
  {
    id: 'games',
    name: 'Games',
    defaultSources: [
      { id: 'ign_games', name: 'IGN Games', feedUrl: 'https://feeds.feedburner.com/ign/all' },
      { id: 'gamespot', name: 'GameSpot', feedUrl: 'https://www.gamespot.com/feeds/news/' },
      { id: 'kotaku', name: 'Kotaku', feedUrl: 'https://kotaku.com/rss' },
      { id: 'eurogamer', name: 'Eurogamer', feedUrl: 'https://www.eurogamer.net/feed/news' },
    ],
    fallbackImage: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=1200&auto=format&fit=crop',
    colorHex: 0x8b5cf6, // Violet
  },
  {
    id: 'anime',
    name: 'Anime',
    defaultSources: [
      { id: 'ann_news', name: 'Anime News Network', feedUrl: 'https://www.animenewsnetwork.com/all/rss.xml' },
      { id: 'mal_news', name: 'MyAnimeList News', feedUrl: 'https://myanimelist.net/rss/news.xml' },
      { id: 'crunchyroll', name: 'Crunchyroll News', feedUrl: 'https://www.crunchyroll.com/news/rss' },
    ],
    fallbackImage: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=1200&auto=format&fit=crop',
    colorHex: 0xec4899, // Pink
  },
  {
    id: 'movies',
    name: 'Movies',
    defaultSources: [
      { id: 'variety_film', name: 'Variety Film', feedUrl: 'https://variety.com/v/film/feed/' },
      { id: 'deadline_movies', name: 'Deadline Hollywood', feedUrl: 'https://deadline.com/category/movies/feed/' },
      { id: 'rottentomatoes', name: 'Rotten Tomatoes News', feedUrl: 'https://editorial.rottentomatoes.com/feed/' },
    ],
    fallbackImage: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=1200&auto=format&fit=crop',
    colorHex: 0xf59e0b, // Amber
  },
  {
    id: 'music',
    name: 'Music',
    defaultSources: [
      { id: 'pitchfork', name: 'Pitchfork News', feedUrl: 'https://pitchfork.com/rss/news/' },
      { id: 'billboard', name: 'Billboard News', feedUrl: 'https://www.billboard.com/c/music/feed/' },
      { id: 'nme_music', name: 'NME Music', feedUrl: 'https://www.nme.com/news/music/feed' },
    ],
    fallbackImage: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=1200&auto=format&fit=crop',
    colorHex: 0x10b981, // Emerald
  },
];

function getCategoryDef(categoryId) {
  return NEWSROOM_CATEGORIES.find((c) => c.id.toLowerCase() === categoryId.toLowerCase());
}

module.exports = {
  NEWSROOM_CATEGORIES,
  getCategoryDef,
};
