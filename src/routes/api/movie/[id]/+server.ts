import { json } from '@sveltejs/kit';
import { TMDB_API_KEY } from '$env/static/private';
import type { RequestHandler } from './$types';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

export const GET: RequestHandler = async ({ params }) => {
  const { id } = params;

  try {
    // Fetch movie details
    const [movieResponse, creditsResponse] = await Promise.all([
      fetch(`${TMDB_BASE_URL}/movie/${id}?api_key=${TMDB_API_KEY}&language=en-US`),
      fetch(`${TMDB_BASE_URL}/movie/${id}/credits?api_key=${TMDB_API_KEY}&language=en-US`),
    ]);

    if (!movieResponse.ok || !creditsResponse.ok) {
      throw new Error('Failed to fetch movie data');
    }

    const movieData = await movieResponse.json();
    const creditsData = await creditsResponse.json();

    const movie = {
      id: movieData.id,
      title: movieData.title,
      overview: movieData.overview,
      posterPath: movieData.poster_path
        ? `https://image.tmdb.org/t/p/w500${movieData.poster_path}`
        : null,
      backdropPath: movieData.backdrop_path
        ? `https://image.tmdb.org/t/p/original${movieData.backdrop_path}`
        : null,
      rating: movieData.vote_average,
      releaseDate: movieData.release_date,
      runtime: movieData.runtime,
      cast: creditsData.cast.map((member: any) => ({
        id: member.id,
        name: member.name,
        character: member.character,
        profilePath: member.profile_path
          ? `https://image.tmdb.org/t/p/w185${member.profile_path}`
          : null,
      })),
    };

    return json({ movie });
  } catch (error) {
    console.error('Movie details error:', error);
    return json({ error: 'Failed to fetch movie details' }, { status: 500 });
  }
};
