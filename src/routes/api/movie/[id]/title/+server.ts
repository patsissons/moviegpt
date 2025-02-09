import { json } from '@sveltejs/kit';
import { TMDB_API_KEY } from '$env/static/private';
import type { RequestHandler } from './$types';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

export const GET: RequestHandler = async ({ params }) => {
  const { id } = params;

  const response = await fetch(
    `${TMDB_BASE_URL}/movie/${id}?api_key=${TMDB_API_KEY}&language=en-US`,
  );
  if (!response.ok) {
    throw new Error('Failed to fetch movie data');
  }

  const movie = await response.json();

  return json({ id: movie.id, title: movie.title, year: movie.release_date.split('-')[0] });
};
