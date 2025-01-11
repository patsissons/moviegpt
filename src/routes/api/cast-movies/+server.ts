import { json } from '@sveltejs/kit';
import { TMDB_API_KEY } from '$env/static/private';
import type { RequestHandler } from './$types';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

export const GET: RequestHandler = async ({ url }) => {
    const castIds = url.searchParams.get('ids')?.split(',');
    const movieId = url.searchParams.get('movieId');

    // If movieId is provided, fetch and return detailed movie info
    if (movieId) {
        try {
            const response = await fetch(
                `${TMDB_BASE_URL}/movie/${movieId}?api_key=${TMDB_API_KEY}&language=en-US`
            );
            if (!response.ok) return json({ error: 'Movie not found' }, { status: 404 });
            const movie = await response.json();
            return json({
                movie: {
                    id: movie.id,
                    title: movie.title,
                    overview: movie.overview,
                    posterPath: movie.poster_path ? `https://image.tmdb.org/t/p/w200${movie.poster_path}` : null,
                    releaseDate: movie.release_date
                }
            });
        } catch (error) {
            console.error('Movie details error:', error);
            return json({ error: 'Failed to fetch movie details' }, { status: 500 });
        }
    }

    // Otherwise, return basic movie info from cast credits
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

        // Create a map of movie IDs to their cast members and basic info
        const movieMap = new Map<number, {
            castIds: Map<number, string>;
            title: string;
            posterPath: string | null;
            releaseDate: string;
            vote: number;
        }>();

        creditsData.forEach((data, index) => {
            const castId = parseInt(castIds[index]);
            data.cast.forEach((movie: any) => {
                const existing = movieMap.get(movie.id);
                if (existing) {
                    existing.castIds.set(castId, movie.character);
                } else if (movie.vote_count > 100) {
                    movieMap.set(movie.id, {
                        castIds: new Map([[castId, movie.character]]),
                        title: movie.title,
                        posterPath: movie.poster_path ? `https://image.tmdb.org/t/p/w200${movie.poster_path}` : null,
                        releaseDate: movie.release_date,
                        vote: movie.vote_average
                    });
                }
            });
        });

        // Convert map to array and sort
        const movies = Array.from(movieMap.entries())
            .map(([id, data]) => ({
                id,
                title: data.title,
                posterPath: data.posterPath,
                releaseDate: data.releaseDate,
                vote: data.vote,
                castIds: Object.keys(data.castIds).map(Number),
                cast: Object.fromEntries(data.castIds.entries()),
                isDetailLoaded: false
            }))
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
