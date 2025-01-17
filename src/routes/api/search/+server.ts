import { json } from '@sveltejs/kit';
import { TMDB_API_KEY } from '$env/static/private';
import type { RequestHandler } from './$types';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

type SearchMovie = {
  id: number;
  title: string;
  poster_path: string;
  release_date: string;
  vote_average: number;
  vote_count: number;
};

export const GET: RequestHandler = async ({ url }) => {
  const query = url.searchParams.get('q');

  if (!query) {
    return json({ results: [] });
  }

  try {
    const response = await fetch(
      `${TMDB_BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&language=en-US&page=1`,
    );

    if (!response.ok) {
      throw new Error('Failed to fetch from TMDB');
    }

    const data = await response.json() as { results: SearchMovie[] };
    const filteredResults = data.results.filter((movie) => movie.vote_count > 100);
    const results = (filteredResults.length > 0 ? filteredResults : data.results)
      .slice(0, 25)
      .map((movie: SearchMovie) => ({
        id: movie.id,
        title: movie.title,
        posterPath: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null,
        releaseDate: movie.release_date,
        voteAverage: movie.vote_average,
        voteCount: movie.vote_count,
      }));

    return json({ results });
  } catch (error) {
    console.error('Search error:', error);
    return json({ error: 'Failed to search movies' }, { status: 500 });
  }
};
