export interface NewsroomSource {
  id: string;
  name: string;
  feedUrl: string;
  enabled: boolean;
  isCustom?: boolean;
}

export interface NewsroomCategoryDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  badge: string;
  defaultSources: NewsroomSource[];
}

export interface NewsroomConfig {
  enabled: boolean;
  channel_id: string; // primary / fallback channel
  upcoming_channel_id?: string; // channel for upcoming drops, announcements, trailers
  review_channel_id?: string; // channel for reviews, ratings, editorials
  posting_frequency: '15m' | '30m' | '1h' | '6h' | '12h' | '24h';
  max_posts_per_run: number;
  ai_summaries: boolean;
  enabled_sources: string[]; // array of source ids that are toggled on
  custom_sources: NewsroomSource[];
  keyword_blacklist: string[];
  keyword_whitelist: string[];
}

export const NEWSROOM_CATEGORIES: NewsroomCategoryDef[] = [
  {
    id: 'games',
    name: 'Games',
    description: 'Gaming news, release announcements, reviews, and industry updates.',
    icon: '🎮',
    color: 'from-purple-500 to-indigo-600',
    badge: 'Gaming',
    defaultSources: [
      { id: 'ign_games', name: 'IGN Games', feedUrl: 'https://feeds.feedburner.com/ign/all', enabled: true },
      { id: 'gamespot', name: 'GameSpot', feedUrl: 'https://www.gamespot.com/feeds/news/', enabled: true },
      { id: 'kotaku', name: 'Kotaku', feedUrl: 'https://kotaku.com/rss', enabled: true },
      { id: 'eurogamer', name: 'Eurogamer', feedUrl: 'https://www.eurogamer.net/feed/news', enabled: false },
    ],
  },
  {
    id: 'anime',
    name: 'Anime',
    description: 'Anime episode releases, manga adaptations, industry news, and trailer drops.',
    icon: '⛩️',
    color: 'from-pink-500 to-rose-600',
    badge: 'Anime',
    defaultSources: [
      { id: 'ann_news', name: 'Anime News Network', feedUrl: 'https://www.animenewsnetwork.com/all/rss.xml', enabled: true },
      { id: 'mal_news', name: 'MyAnimeList News', feedUrl: 'https://myanimelist.net/rss/news.xml', enabled: true },
      { id: 'crunchyroll', name: 'Crunchyroll News', feedUrl: 'https://www.crunchyroll.com/news/rss', enabled: true },
    ],
  },
  {
    id: 'movies',
    name: 'Movies',
    description: 'Film announcements, trailer releases, box office updates, and movie reviews.',
    icon: '🎬',
    color: 'from-amber-500 to-red-600',
    badge: 'Cinema',
    defaultSources: [
      { id: 'variety_film', name: 'Variety Film', feedUrl: 'https://variety.com/v/film/feed/', enabled: true },
      { id: 'deadline_movies', name: 'Deadline Hollywood', feedUrl: 'https://deadline.com/category/movies/feed/', enabled: true },
      { id: 'rottentomatoes', name: 'Rotten Tomatoes News', feedUrl: 'https://editorial.rottentomatoes.com/feed/', enabled: true },
    ],
  },
  {
    id: 'music',
    name: 'Music',
    description: 'Album drops, single releases, music festival news, and artist spotlights.',
    icon: '🎵',
    color: 'from-emerald-500 to-teal-600',
    badge: 'Music',
    defaultSources: [
      { id: 'pitchfork', name: 'Pitchfork News', feedUrl: 'https://pitchfork.com/rss/news/', enabled: true },
      { id: 'billboard', name: 'Billboard News', feedUrl: 'https://www.billboard.com/c/music/feed/', enabled: true },
      { id: 'nme_music', name: 'NME Music', feedUrl: 'https://www.nme.com/news/music/feed', enabled: true },
    ],
  },
];

export function getNewsroomCategory(categoryId: string): NewsroomCategoryDef | undefined {
  return NEWSROOM_CATEGORIES.find((cat) => cat.id.toLowerCase() === categoryId.toLowerCase());
}

export function getDefaultNewsroomConfig(categoryId: string): NewsroomConfig {
  const category = getNewsroomCategory(categoryId);
  const defaultEnabledSources = category
    ? category.defaultSources.filter((s) => s.enabled).map((s) => s.id)
    : [];

  return {
    enabled: false,
    channel_id: '',
    upcoming_channel_id: '',
    review_channel_id: '',
    posting_frequency: '30m',
    max_posts_per_run: 2,
    ai_summaries: false,
    enabled_sources: defaultEnabledSources,
    custom_sources: [],
    keyword_blacklist: [],
    keyword_whitelist: [],
  };
}
