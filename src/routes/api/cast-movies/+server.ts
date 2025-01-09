import { json } from '@sveltejs/kit';
import { TMDB_API_KEY } from '$env/static/private';
import type { RequestHandler } from './$types';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

export const GET: RequestHandler = async ({ url }) => {
    const castIds = url.searchParams.get('ids')?.split(',');

    if (!castIds?.length) {
        return json({ results: [] });
    }

    try {
        // Fetch movies for each cast member
        const moviePromises = castIds.map(async (id) => {
            const response = await fetch(
                `${TMDB_BASE_URL}/person/${id}/movie_credits?api_key=${TMDB_API_KEY}&language=en-US`
            );
            if (!response.ok) throw new Error(`Failed to fetch movies for cast ${id}`);
            return response.json();
        });

        const creditsData = await Promise.all(moviePromises);

        // Create a map of movie IDs to their cast members from our selected list
        const movieCastMap = new Map<number, Set<number>>();
        creditsData.forEach((data, index) => {
            const castId = parseInt(castIds[index]);
            data.cast.forEach((movie: any) => {
                const existing = movieCastMap.get(movie.id) || new Set();
                existing.add(castId);
                movieCastMap.set(movie.id, existing);
            });
        });

        // Get unique movie IDs
        const uniqueMovieIds = Array.from(movieCastMap.keys());

        // Fetch full details for each movie
        const movieDetailsPromises = uniqueMovieIds.slice(0, 20).map(async (movieId) => {
            const response = await fetch(
                `${TMDB_BASE_URL}/movie/${movieId}?api_key=${TMDB_API_KEY}&language=en-US`
            );
            if (!response.ok) return null;
            const movie = await response.json();
            return {
                id: movie.id,
                title: movie.title,
                overview: movie.overview,
                posterPath: movie.poster_path ? `https://image.tmdb.org/t/p/w200${movie.poster_path}` : null,
                releaseDate: movie.release_date,
                castIds: Array.from(movieCastMap.get(movie.id) || [])
            };
        });

        const movies = (await Promise.all(movieDetailsPromises))
            .filter((movie): movie is NonNullable<typeof movie> => movie !== null)
            .sort((a, b) => {
                // Sort by number of matching cast members (descending) and then by release date (descending)
                const castDiff = b.castIds.length - a.castIds.length;
                if (castDiff !== 0) return castDiff;
                return new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime();
            });

        return json({ results: movies });
    } catch (error) {
        console.error('Cast movies search error:', error);
        return json({ error: 'Failed to search movies by cast' }, { status: 500 });
    }
};
