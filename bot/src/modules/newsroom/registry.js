/**
 * ENOS Newsroom Registry
 * Category definitions and default RSS feeds for Games, Anime, Movies, and Music.
 */

const NEWSROOM_CATEGORIES = [
  {
    id: 'games',
    name: 'Games',
    emoji: '🎮',
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
    emoji: '⛩️',
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
    emoji: '🍿',
    defaultSources: [
      // YouTube studio/trailer channels — items come with direct youtube.com/watch URLs
      // All channel IDs below verified live (HTTP 200, entries confirmed)
      { id: 'yt_movieclips',  name: 'Movieclips Trailers',    feedUrl: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCi8e0iOVk1fEOogdfu4YgfA' },
      { id: 'yt_warnerbros',  name: 'Warner Bros. Pictures',  feedUrl: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCjmJDM5pRKbUlVIzDYYWb6g' },
      { id: 'yt_universal',   name: 'Universal Pictures',     feedUrl: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCq-Fj5jknLsUf-MWSy4_brA' },
      { id: 'yt_paramount',   name: 'Paramount Pictures',     feedUrl: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCF9IOB2TExg3QIBupFtBDxg' },
      { id: 'yt_marvel',      name: 'Marvel Entertainment',   feedUrl: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCvC4D8onUfXzvjTOM-dBfEA' },
      { id: 'yt_20thcentury', name: '20th Century Studios',   feedUrl: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCzWQYUVCpZqtN93H8RR44Qw' },
      // News fallback for non-trailer movie content (casting, box office, release dates)
      { id: 'deadline_movies', name: 'Deadline Hollywood',    feedUrl: 'https://deadline.com/category/movies/feed/' },
    ],
    fallbackImage: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=1200&auto=format&fit=crop',
    colorHex: 0xf59e0b, // Amber
  },
  {
    id: 'music',
    name: 'Music',
    emoji: '🎵',
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
