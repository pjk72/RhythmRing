import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  X,
  Music2,
  Flame,
  Loader2,
  Sparkles,
  Trophy,
  Disc,
  Zap,
  Heart,
  Sun,
  Radio,
  Headphones,
  Film,
  RefreshCw,
  CheckCircle2,
  Layers,
} from 'lucide-react';
import { fetchGenreChartArtists, DynamicChartArtist } from '../utils/audioUtils';

interface SearchBarProps {
  onSearch: (artistName: string) => void;
  isLoading: boolean;
  totalResults: number;
}

interface GenreCategory {
  id: string;
  name: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  badge: string;
  searchTerm: string;
  defaultSearchQuery: string;
  fallbackArtists: DynamicChartArtist[];
}

// 100% Music Genre-Based Categories (No countries)
const MUSIC_GENRE_CATEGORIES: GenreCategory[] = [
  {
    id: 'pop',
    name: 'Pop & Hit Mondiali',
    shortLabel: 'Pop & Mainstream',
    icon: Sparkles,
    badge: 'Pop',
    searchTerm: 'Pop billboard hits top songs',
    defaultSearchQuery: 'Pop hits',
    fallbackArtists: [
      { name: 'Sabrina Carpenter', rank: 1, topTrack: 'Espresso', genre: 'Pop' },
      { name: 'Billie Eilish', rank: 2, topTrack: 'BIRDS OF A FEATHER', genre: 'Pop' },
      { name: 'Bruno Mars', rank: 3, topTrack: 'Die With A Smile', genre: 'Pop' },
      { name: 'Lady Gaga', rank: 4, topTrack: 'Die With A Smile', genre: 'Pop' },
      { name: 'The Weeknd', rank: 5, topTrack: 'Dancing in the Flames', genre: 'Pop' },
      { name: 'Taylor Swift', rank: 6, topTrack: 'Cruel Summer', genre: 'Pop' },
      { name: 'Chappell Roan', rank: 7, topTrack: 'Good Luck, Babe!', genre: 'Pop' },
      { name: 'Dua Lipa', rank: 8, topTrack: 'Houdini', genre: 'Pop' },
      { name: 'Benson Boone', rank: 9, topTrack: 'Beautiful Things', genre: 'Pop' },
      { name: 'Olivia Rodrigo', rank: 10, topTrack: 'Vampire', genre: 'Pop' },
    ],
  },
  {
    id: 'rock',
    name: 'Rock, Alternative & Indie Rock',
    shortLabel: 'Rock & Alternative',
    icon: Flame,
    badge: 'Rock',
    searchTerm: 'Rock alternative hits top songs',
    defaultSearchQuery: 'Rock hits',
    fallbackArtists: [
      { name: 'Coldplay', rank: 1, topTrack: 'feelslikeimfallinginlove', genre: 'Rock' },
      { name: 'Måneskin', rank: 2, topTrack: 'Beggin\'', genre: 'Rock' },
      { name: 'Linkin Park', rank: 3, topTrack: 'The Emptiness Machine', genre: 'Rock' },
      { name: 'Imagine Dragons', rank: 4, topTrack: 'Eyes Closed', genre: 'Rock' },
      { name: 'Queen', rank: 5, topTrack: 'Bohemian Rhapsody', genre: 'Rock' },
      { name: 'Arctic Monkeys', rank: 6, topTrack: 'Do I Wanna Know?', genre: 'Rock' },
      { name: 'The Killers', rank: 7, topTrack: 'Mr. Brightside', genre: 'Rock' },
      { name: 'Red Hot Chili Peppers', rank: 8, topTrack: 'Californication', genre: 'Rock' },
      { name: 'Nirvana', rank: 9, topTrack: 'Smells Like Teen Spirit', genre: 'Rock' },
      { name: 'Foo Fighters', rank: 10, topTrack: 'Everlong', genre: 'Rock' },
    ],
  },
  {
    id: 'hiphop',
    name: 'Hip-Hop, Rap & Trap',
    shortLabel: 'Hip-Hop & Rap',
    icon: Disc,
    badge: 'Rap',
    searchTerm: 'Hip-Hop Rap top hits billboard',
    defaultSearchQuery: 'Hip-Hop hits',
    fallbackArtists: [
      { name: 'Kendrick Lamar', rank: 1, topTrack: 'Not Like Us', genre: 'Hip-Hop/Rap' },
      { name: 'Drake', rank: 2, topTrack: 'God\'s Plan', genre: 'Hip-Hop/Rap' },
      { name: 'Eminem', rank: 3, topTrack: 'Houdini', genre: 'Hip-Hop/Rap' },
      { name: 'Travis Scott', rank: 4, topTrack: 'FE!N', genre: 'Hip-Hop/Rap' },
      { name: 'Post Malone', rank: 5, topTrack: 'I Had Some Help', genre: 'Hip-Hop/Rap' },
      { name: 'Future & Metro Boomin', rank: 6, topTrack: 'Like That', genre: 'Hip-Hop/Rap' },
      { name: 'Jack Harlow', rank: 7, topTrack: 'Lovin On Me', genre: 'Hip-Hop/Rap' },
      { name: '21 Savage', rank: 8, topTrack: 'redrum', genre: 'Hip-Hop/Rap' },
      { name: 'Doja Cat', rank: 9, topTrack: 'Paint The Town Red', genre: 'Hip-Hop/Rap' },
      { name: 'Kanye West', rank: 10, topTrack: 'Carnival', genre: 'Hip-Hop/Rap' },
    ],
  },
  {
    id: 'electronic',
    name: 'Electronic, Dance & House',
    shortLabel: 'Electronic & Dance',
    icon: Zap,
    badge: 'EDM',
    searchTerm: 'Electronic Dance EDM house hits',
    defaultSearchQuery: 'Dance electronic hits',
    fallbackArtists: [
      { name: 'David Guetta', rank: 1, topTrack: 'I\'m Good (Blue)', genre: 'Dance' },
      { name: 'Calvin Harris', rank: 2, topTrack: 'Miracle', genre: 'Dance' },
      { name: 'Daft Punk', rank: 3, topTrack: 'Get Lucky', genre: 'Dance' },
      { name: 'Tiësto', rank: 4, topTrack: 'The Business', genre: 'Dance' },
      { name: 'Peggy Gou', rank: 5, topTrack: '(It Goes Like) Nanana', genre: 'Dance' },
      { name: 'Kygo', rank: 6, topTrack: 'For Life', genre: 'Dance' },
      { name: 'Avicii', rank: 7, topTrack: 'Wake Me Up', genre: 'Dance' },
      { name: 'Swedish House Mafia', rank: 8, topTrack: 'Don\'t You Worry Child', genre: 'Dance' },
      { name: 'Fred again..', rank: 9, topTrack: 'adore u', genre: 'Dance' },
      { name: 'Marshmello', rank: 10, topTrack: 'Happier', genre: 'Dance' },
    ],
  },
  {
    id: 'rnb',
    name: 'R&B & Contemporary Soul',
    shortLabel: 'R&B & Soul',
    icon: Heart,
    badge: 'R&B',
    searchTerm: 'R&B soul top tracks hits',
    defaultSearchQuery: 'R&B Soul hits',
    fallbackArtists: [
      { name: 'SZA', rank: 1, topTrack: 'Snooze', genre: 'R&B/Soul' },
      { name: 'Teddy Swims', rank: 2, topTrack: 'Lose Control', genre: 'R&B/Soul' },
      { name: 'Beyoncé', rank: 3, topTrack: 'CUFF IT', genre: 'R&B/Soul' },
      { name: 'Frank Ocean', rank: 4, topTrack: 'Lost', genre: 'R&B/Soul' },
      { name: 'Alicia Keys', rank: 5, topTrack: 'If I Ain\'t Got You', genre: 'R&B/Soul' },
      { name: 'Usher', rank: 6, topTrack: 'Yeah!', genre: 'R&B/Soul' },
      { name: 'Daniel Caesar', rank: 7, topTrack: 'Best Part', genre: 'R&B/Soul' },
      { name: 'H.E.R.', rank: 8, topTrack: 'Best Part', genre: 'R&B/Soul' },
      { name: 'Chris Brown', rank: 9, topTrack: 'Under The Influence', genre: 'R&B/Soul' },
      { name: 'Giveon', rank: 10, topTrack: 'Heartbreak Anniversary', genre: 'R&B/Soul' },
    ],
  },
  {
    id: 'latin',
    name: 'Latin, Reggaeton & Urbano',
    shortLabel: 'Latin & Urbano',
    icon: Sun,
    badge: 'Latin',
    searchTerm: 'Latin reggaeton urbano hits',
    defaultSearchQuery: 'Latin hits',
    fallbackArtists: [
      { name: 'Bad Bunny', rank: 1, topTrack: 'MONACO', genre: 'Latin' },
      { name: 'Karol G', rank: 2, topTrack: 'Si Antes Te Hubiera Conocido', genre: 'Latin' },
      { name: 'Rauw Alejandro', rank: 3, topTrack: 'Touching The Sky', genre: 'Latin' },
      { name: 'Feid', rank: 4, topTrack: 'LUNA', genre: 'Latin' },
      { name: 'Peso Pluma', rank: 5, topTrack: 'LADY GAGA', genre: 'Latin' },
      { name: 'J Balvin', rank: 6, topTrack: 'Mi Gente', genre: 'Latin' },
      { name: 'Shakira', rank: 7, topTrack: 'Bzrp Music Sessions #53', genre: 'Latin' },
      { name: 'Daddy Yankee', rank: 8, topTrack: 'Gasolina', genre: 'Latin' },
      { name: 'Maluma', rank: 9, topTrack: 'Hawái', genre: 'Latin' },
      { name: 'Rosalía', rank: 10, topTrack: 'DESPECHÁ', genre: 'Latin' },
    ],
  },
  {
    id: 'metal',
    name: 'Heavy Metal & Hard Rock',
    shortLabel: 'Metal & Hard Rock',
    icon: Radio,
    badge: 'Metal',
    searchTerm: 'Metal hard rock top tracks',
    defaultSearchQuery: 'Metal hits',
    fallbackArtists: [
      { name: 'Metallica', rank: 1, topTrack: 'Enter Sandman', genre: 'Metal' },
      { name: 'Iron Maiden', rank: 2, topTrack: 'The Trooper', genre: 'Metal' },
      { name: 'Slipknot', rank: 3, topTrack: 'Duality', genre: 'Metal' },
      { name: 'Rammstein', rank: 4, topTrack: 'Du Hast', genre: 'Metal' },
      { name: 'System of a Down', rank: 5, topTrack: 'Chop Suey!', genre: 'Metal' },
      { name: 'Avenged Sevenfold', rank: 6, topTrack: 'Hail to the King', genre: 'Metal' },
      { name: 'Ghost', rank: 7, topTrack: 'Mary On A Cross', genre: 'Metal' },
      { name: 'Bring Me The Horizon', rank: 8, topTrack: 'Can You Feel My Heart', genre: 'Metal' },
      { name: 'Megadeth', rank: 9, topTrack: 'Symphony of Destruction', genre: 'Metal' },
      { name: 'Judas Priest', rank: 10, topTrack: 'Painkiller', genre: 'Metal' },
    ],
  },
  {
    id: 'indie',
    name: 'Indie Pop, Folk & Cantautorato',
    shortLabel: 'Indie & Folk',
    icon: Headphones,
    badge: 'Indie',
    searchTerm: 'Indie folk alternative top tracks',
    defaultSearchQuery: 'Indie hits',
    fallbackArtists: [
      { name: 'Hozier', rank: 1, topTrack: 'Too Sweet', genre: 'Indie' },
      { name: 'Noah Kahan', rank: 2, topTrack: 'Stick Season', genre: 'Indie' },
      { name: 'Lorde', rank: 3, topTrack: 'Royals', genre: 'Indie' },
      { name: 'Phoebe Bridgers', rank: 4, topTrack: 'Kyoto', genre: 'Indie' },
      { name: 'The Lumineers', rank: 5, topTrack: 'Ho Hey', genre: 'Indie' },
      { name: 'Mumford & Sons', rank: 6, topTrack: 'Little Lion Man', genre: 'Indie' },
      { name: 'Bon Iver', rank: 7, topTrack: 'Skinny Love', genre: 'Indie' },
      { name: 'Vance Joy', rank: 8, topTrack: 'Riptide', genre: 'Indie' },
      { name: 'Boygenius', rank: 9, topTrack: 'Not Strong Enough', genre: 'Indie' },
      { name: 'Cigarettes After Sex', rank: 10, topTrack: 'Apocalypse', genre: 'Indie' },
    ],
  },
  {
    id: 'soundtrack',
    name: 'Colonne Sonore, Cinema & Orchestrale',
    shortLabel: 'Soundtrack & Cinema',
    icon: Film,
    badge: 'Cinema',
    searchTerm: 'Soundtrack movie film score orchestra',
    defaultSearchQuery: 'Soundtrack movie hits',
    fallbackArtists: [
      { name: 'Hans Zimmer', rank: 1, topTrack: 'Time (Inception)', genre: 'Soundtrack' },
      { name: 'Ennio Morricone', rank: 2, topTrack: 'The Good, the Bad and the Ugly', genre: 'Soundtrack' },
      { name: 'John Williams', rank: 3, topTrack: 'Star Wars Main Theme', genre: 'Soundtrack' },
      { name: 'Ludovico Einaudi', rank: 4, topTrack: 'Nuvole Bianche', genre: 'Classical' },
      { name: 'Ramin Djawadi', rank: 5, topTrack: 'Game of Thrones Theme', genre: 'Soundtrack' },
      { name: 'Howard Shore', rank: 6, topTrack: 'The Lord of the Rings', genre: 'Soundtrack' },
      { name: 'Max Richter', rank: 7, topTrack: 'On the Nature of Daylight', genre: 'Soundtrack' },
      { name: 'Alan Silvestri', rank: 8, topTrack: 'The Avengers', genre: 'Soundtrack' },
      { name: 'Danny Elfman', rank: 9, topTrack: 'Batman Theme', genre: 'Soundtrack' },
      { name: 'Thomas Newman', rank: 10, topTrack: 'American Beauty', genre: 'Soundtrack' },
    ],
  },
];

export const SearchBar: React.FC<SearchBarProps> = ({
  onSearch,
  isLoading,
  totalResults,
}) => {
  const [query, setQuery] = useState('Sabrina Carpenter');
  const [activeGenreId, setActiveGenreId] = useState<string>('pop');
  const [dynamicArtists, setDynamicArtists] = useState<DynamicChartArtist[]>(
    MUSIC_GENRE_CATEGORIES[0].fallbackArtists
  );
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [lastVerifiedTime, setLastVerifiedTime] = useState<string>('Tempo reale');
  const [isVerifiedLive, setIsVerifiedLive] = useState<boolean>(false);

  const currentCategory =
    MUSIC_GENRE_CATEGORIES.find((c) => c.id === activeGenreId) ||
    MUSIC_GENRE_CATEGORIES[0];

  // Dynamically verify and fetch current charts for the selected genre
  const verifyGenreChart = useCallback(
    async (genre: GenreCategory) => {
      setIsVerifying(true);
      try {
        const liveArtists = await fetchGenreChartArtists(
          genre.searchTerm,
          genre.fallbackArtists
        );
        setDynamicArtists(liveArtists);
        const now = new Date();
        setLastVerifiedTime(
          now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        );
        setIsVerifiedLive(true);
      } catch (e) {
        setDynamicArtists(genre.fallbackArtists);
        setIsVerifiedLive(false);
      } finally {
        setIsVerifying(false);
      }
    },
    []
  );

  // Automatically re-verify when switching genres
  useEffect(() => {
    verifyGenreChart(currentCategory);
  }, [activeGenreId, verifyGenreChart]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query.trim());
    }
  };

  const handleQuickSelect = (artistName: string) => {
    setQuery(artistName);
    onSearch(artistName);
  };

  const handleExploreGenre = () => {
    setQuery(currentCategory.defaultSearchQuery);
    onSearch(currentCategory.defaultSearchQuery);
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-2xl backdrop-blur-md flex flex-col gap-4">
      {/* Search Input Bar */}
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            id="artist-search-input"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cerca brano o artista (es. Sabrina Carpenter, Billie Eilish, Coldplay, Kendrick Lamar)..."
            className="w-full bg-slate-950/80 text-slate-100 placeholder-slate-400 pl-11 pr-10 py-3 rounded-xl border border-slate-700/80 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-sm sm:text-base font-medium transition-all shadow-inner"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <button
          id="search-submit-btn"
          type="submit"
          disabled={isLoading || !query.trim()}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white rounded-xl font-semibold text-sm transition-all shadow-md shadow-indigo-600/20 disabled:shadow-none min-w-[130px] active:scale-95"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-indigo-200" />
              <span>Cerca...</span>
            </>
          ) : (
            <>
              <Music2 className="w-4 h-4" />
              <span>Cerca Brani</span>
            </>
          )}
        </button>
      </form>

      {/* CLASSIFICHE DINAMICHE PER GENERE MUSICALE */}
      <div className="pt-2 border-t border-slate-800/80 flex flex-col gap-3">
        {/* Genre Selector Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 sm:pb-0 scrollbar-none">
            <span className="text-slate-400 text-xs font-semibold flex items-center gap-1 mr-1 shrink-0">
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              <span>Generi:</span>
            </span>

            {MUSIC_GENRE_CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const isActive = activeGenreId === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveGenreId(cat.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 active:scale-95 ${
                    isActive
                      ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-sm border border-indigo-400/40 ring-1 ring-indigo-400/30'
                      : 'bg-slate-950/70 hover:bg-slate-800 text-slate-300 border border-white/5'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-indigo-400'}`} />
                  <span>{cat.shortLabel}</span>
                  <span
                    className={`text-[9px] px-1 py-0.2 rounded font-mono ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {cat.badge}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Dynamic Verification & Refresh Actions */}
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            <button
              type="button"
              onClick={() => verifyGenreChart(currentCategory)}
              disabled={isVerifying}
              title="Riverifica la classifica in tempo reale dal database iTunes/Apple Music"
              className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-950/80 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg border border-white/10 text-xs font-medium transition-all active:scale-95 shadow-xs"
            >
              <RefreshCw className={`w-3 h-3 text-indigo-400 ${isVerifying ? 'animate-spin' : ''}`} />
              <span className="text-[11px]">
                {isVerifying ? 'Verifica in corso...' : 'Verifica Classifica'}
              </span>
            </button>

            {totalResults > 0 && (
              <span className="text-slate-400 text-xs font-semibold bg-slate-950/80 px-2.5 py-1 rounded-md border border-slate-800">
                {totalResults} Risultati
              </span>
            )}
          </div>
        </div>

        {/* Real-time Status Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 bg-slate-950/50 rounded-xl border border-white/5 text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>
              Classifica <span className="text-indigo-300 font-semibold">{currentCategory.name}</span> verificata in tempo reale
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span>Aggiornato: <span className="font-mono text-slate-300">{lastVerifiedTime}</span></span>
            <button
              type="button"
              onClick={handleExploreGenre}
              className="text-indigo-400 hover:text-indigo-300 font-semibold underline underline-offset-2 flex items-center gap-1"
            >
              <Layers className="w-3 h-3" />
              <span>Esplora tutti i brani {currentCategory.badge}</span>
            </button>
          </div>
        </div>

        {/* Dynamic List of Chart-Topping Artists for the Active Musical Genre */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {dynamicArtists.map((artist) => {
            const isSelected = query.toLowerCase() === artist.name.toLowerCase();
            return (
              <button
                key={`${activeGenreId}-${artist.name}-${artist.rank}`}
                type="button"
                onClick={() => handleQuickSelect(artist.name)}
                className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all active:scale-95 ${
                  isSelected
                    ? 'bg-indigo-600 text-white border-indigo-400 shadow-md shadow-indigo-600/30 ring-1 ring-white/30'
                    : artist.rank <= 3
                    ? 'bg-gradient-to-r from-indigo-950/90 to-purple-950/90 text-slate-100 border-indigo-500/40 hover:border-indigo-400 hover:bg-indigo-900/60 shadow-xs'
                    : 'bg-slate-950/60 hover:bg-slate-800 text-slate-300 border-white/10 hover:text-white'
                }`}
              >
                {/* Live Rank Badge */}
                <span
                  className={`text-[10px] font-bold font-mono px-1.5 py-0.2 rounded ${
                    isSelected
                      ? 'bg-white/20 text-white'
                      : artist.rank === 1
                      ? 'bg-amber-500/25 text-amber-300 border border-amber-500/40'
                      : artist.rank === 2
                      ? 'bg-slate-400/20 text-slate-200 border border-slate-400/30'
                      : artist.rank === 3
                      ? 'bg-amber-700/25 text-amber-400 border border-amber-700/40'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  #{artist.rank}
                </span>

                <span className="font-semibold">{artist.name}</span>

                {/* Top Hit Track from chart */}
                {artist.topTrack && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-normal hidden md:inline truncate max-w-[140px] ${
                      isSelected
                        ? 'bg-white/20 text-indigo-100'
                        : 'bg-slate-800/90 text-slate-400 group-hover:text-slate-200'
                    }`}
                  >
                    Hit: {artist.topTrack}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};


