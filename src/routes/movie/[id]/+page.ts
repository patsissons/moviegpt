import { error, type LoadEvent } from '@sveltejs/kit';

interface CastMember {
  id: number;
  name: string;
  character: string;
  profilePath: string | null;
}

interface Movie {
  id: number;
  imdbId?: string;
  title: string;
  overview: string;
  posterPath: string | null;
  backdropPath: string | null;
  rating: number;
  releaseDate: string;
  runtime: number;
  cast: CastMember[];
}

interface CastMovie {
  id: number;
  imdbId?: string;
  title: string;
  overview?: string;
  posterPath: string | null;
  rating: number;
  releaseDate: string;
  runtime: number;
  vote: number;
  castIds: number[];
  cast: Record<number, string>;
  isDetailLoaded: boolean;
  isLoading?: boolean;
}

type SortBy = 'year' | 'rating';

export interface PageData {
  movie: Movie;
  castMovies: CastMovie[];
  selectedCastIds: number[];
  sortBy: SortBy;
}

export const load = async ({ fetch, params, url }: LoadEvent) => {
  try {
    // Get selected cast IDs from URL
    const searchParams = url.searchParams;
    const castParam = searchParams.get('cast');
    const sortParam = searchParams.get('sort') as SortBy | null;
    const selectedCastIds = castParam ? castParam.split(',').map(Number) : [];

    // Fetch movie details
    const movieResponse = await fetch(`/api/movie/${params.id}`);
    if (!movieResponse.ok) {
      throw error(404, 'Movie not found');
    }
    const movieData = await movieResponse.json();

    // If there are selected cast members, fetch their movies
    let castMovies = [];
    if (selectedCastIds.length > 0) {
      const castMoviesResponse = await fetch(`/api/cast-movies?ids=${selectedCastIds.join(',')}`);
      if (castMoviesResponse.ok) {
        const castMoviesData = await castMoviesResponse.json();
        castMovies = castMoviesData.results;
      }
    }

    return {
      movie: movieData.movie as Movie,
      castMovies,
      selectedCastIds,
      sortBy: sortParam || 'year',
    } satisfies PageData;
  } catch (err) {
    console.error('Error loading movie data:', err);
    throw error(500, 'Unable to load movie data');
  }
};
