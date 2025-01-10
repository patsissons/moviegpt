<script lang="ts">
    import { page } from '$app/stores';
    import { onMount } from 'svelte';

    interface CastMember {
        id: number;
        name: string;
        character: string;
        profilePath: string | null;
    }

    interface Movie {
        id: number;
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
        title: string;
        overview?: string;
        posterPath: string | null;
        releaseDate: string;
        castIds: number[];
        isDetailLoaded: boolean;
        isLoading?: boolean;
    }

    let movie: Movie | null = null;
    let error: string | null = null;
    let isLoading = true;
    let selectedCastIds = new Set<number>();
    let castMovies: CastMovie[] = [];
    let isCastMoviesLoading = false;
    let hasPerformedSearch = false;
    let castMoviesError: string | null = null;
    let castSearchTimer: NodeJS.Timeout;
    let observers = new Map<number, IntersectionObserver>();

    async function loadMovieDetails(id: string) {
        try {
            const response = await fetch(`/api/movie/${id}`);
            if (!response.ok) throw new Error('Failed to load movie details');
            const data = await response.json();
            movie = data.movie;
            // Clear selections when loading a new movie
            selectedCastIds.clear();
            selectedCastIds = selectedCastIds;
            castMovies = [];
            hasPerformedSearch = false;
            // Clean up any existing observers
            observers.forEach(observer => observer.disconnect());
            observers.clear();
        } catch (e) {
            error = 'Failed to load movie details';
        } finally {
            isLoading = false;
        }
    }

    async function loadCastMovieDetails(castMovie: CastMovie) {
        if (castMovie.isDetailLoaded || castMovie.isLoading) return;

        castMovie.isLoading = true;
        castMovies = castMovies; // Trigger reactivity

        try {
            const response = await fetch(`/api/cast-movies?movieId=${castMovie.id}`);
            if (!response.ok) throw new Error('Failed to load movie details');
            const data = await response.json();

            // Update the movie with full details
            const index = castMovies.findIndex(m => m.id === castMovie.id);
            if (index !== -1) {
                castMovies[index] = {
                    ...castMovies[index],
                    ...data.movie,
                    isDetailLoaded: true,
                    isLoading: false
                };
                castMovies = castMovies; // Trigger reactivity
            }
        } catch (e) {
            console.error(`Failed to load details for movie ${castMovie.id}:`, e);
            castMovie.isLoading = false;
            castMovies = castMovies; // Trigger reactivity
        }
    }

    function observeMovie(node: HTMLElement, movie: CastMovie) {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        loadCastMovieDetails(movie);
                        observer.unobserve(node);
                    }
                });
            },
            { rootMargin: '50px' }
        );

        observer.observe(node);
        observers.set(movie.id, observer);

        return {
            destroy() {
                observer.disconnect();
                observers.delete(movie.id);
            }
        };
    }

    async function searchCastMovies() {
        if (selectedCastIds.size === 0) {
            castMovies = [];
            hasPerformedSearch = false;
            return;
        }

        isCastMoviesLoading = true;
        castMoviesError = null;

        try {
            const response = await fetch(`/api/cast-movies?ids=${Array.from(selectedCastIds).join(',')}`);
            if (!response.ok) throw new Error('Failed to search cast movies');
            const data = await response.json();
            castMovies = data.results;
        } catch (e) {
            castMoviesError = 'Failed to load cast movies';
            castMovies = [];
        } finally {
            isCastMoviesLoading = false;
            hasPerformedSearch = true;
        }
    }

    function toggleCastSelection(castId: number) {
        if (selectedCastIds.has(castId)) {
            selectedCastIds.delete(castId);
            if (selectedCastIds.size === 0) {
                hasPerformedSearch = false;
            }
        } else {
            selectedCastIds.add(castId);
        }
        selectedCastIds = selectedCastIds; // Trigger reactivity
    }

    // Watch for changes in selected cast members and debounce the search
    $: if (selectedCastIds) {
        clearTimeout(castSearchTimer);
        castSearchTimer = setTimeout(searchCastMovies, 2500);
    }

    $: if ($page.params.id) {
        loadMovieDetails($page.params.id);
    }

    function formatRuntime(minutes: number): string {
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        return `${hours}h ${remainingMinutes}m`;
    }

    // Helper function to get cast member names for a movie
    function getSelectedCastInMovie(movieCastIds: number[]): string {
        if (!movie) return '';
        return movie.cast
            .filter(member => movieCastIds.includes(member.id))
            .map(member => member.name)
            .join(', ');
    }

    onMount(() => {
        return () => {
            clearTimeout(castSearchTimer);
            // Clean up all observers
            observers.forEach(observer => observer.disconnect());
            observers.clear();
        };
    });
</script>

<div class="min-h-screen bg-gray-100">
    {#if isLoading}
        <div class="flex justify-center items-center min-h-screen">
            <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
    {:else if error}
        <div class="text-red-500 text-center p-4">{error}</div>
    {:else if movie}
        <div class="relative overflow-clip">
            {#if movie.backdropPath}
                <div class="absolute inset-0 h-[50vh]">
                    <div class="absolute inset-0 bg-black/50 z-10"></div>
                    <img
                        src={movie.backdropPath}
                        alt={movie.title}
                        class="w-full h-full object-cover"
                    />
                </div>
            {/if}

            <div class="relative z-20 container mx-auto px-4 py-8">
                <div class="flex flex-col md:flex-row gap-8 items-start">
                    <!-- Movie Poster -->
                    <div class="w-64 flex-shrink-0">
                        {#if movie.posterPath}
                            <img
                                src={movie.posterPath}
                                alt={movie.title}
                                class="w-full rounded-lg shadow-xl"
                            />
                        {:else}
                            <div class="w-full h-96 bg-gray-200 rounded-lg flex items-center justify-center">
                                <span class="text-gray-400">No poster</span>
                            </div>
                        {/if}
                    </div>

                    <!-- Movie Details -->
                    <div class="flex-1 {movie.backdropPath ? 'md:text-white' : 'text-gray-900'}">
                        <h1 class="text-4xl font-bold mb-4">{movie.title}</h1>
                        <div class="mb-4 flex items-center gap-4">
                            <span class="inline-flex items-center bg-yellow-400 text-black px-2 py-1 rounded">
                                ★ {movie.rating.toFixed(1)}
                            </span>
                            <span>{new Date(movie.releaseDate).getFullYear()}</span>
                            <span>{formatRuntime(movie.runtime)}</span>
                        </div>
                        <p class="text-lg mb-8 {movie.backdropPath ? 'md:text-gray-200' : 'text-gray-700'}">
                            {movie.overview}
                        </p>
                    </div>
                </div>
            </div>
        </div>

        <!-- Cast Section -->
        <div class="container mx-auto px-4 py-8">
            <h2 class="text-2xl font-bold mb-4">Cast</h2>
            <div class="overflow-x-auto p-4">
                <div class="flex gap-4" style="min-width: min-content">
                    {#each movie.cast as member (member.id)}
                        <button
                            class="flex-shrink-0 w-32 text-left transition-transform duration-200 focus:outline-none group"
                            class:selected={selectedCastIds.has(member.id)}
                            on:click={() => toggleCastSelection(member.id)}
                        >
                            <div class="w-32 h-32 mb-2 relative rounded-lg overflow-hidden transition-transform duration-200 transform group-hover:scale-105">
                                {#if member.profilePath}
                                    <img
                                        src={member.profilePath}
                                        alt={member.name}
                                        class="w-full h-full object-cover shadow-md"
                                    />
                                {:else}
                                    <div class="w-full h-full bg-gray-200 flex items-center justify-center">
                                        <span class="text-gray-400">No photo</span>
                                    </div>
                                {/if}
                                {#if selectedCastIds.has(member.id)}
                                    <div class="absolute inset-0 bg-blue-500/20 border-2 border-blue-500 rounded-lg"></div>
                                {/if}
                            </div>
                            <h3 class="text-sm font-medium text-gray-900">{member.name}</h3>
                            <p class="text-xs text-gray-500">{member.character}</p>
                        </button>
                    {/each}
                </div>
            </div>
        </div>

        <!-- Cast Movies Section -->
        {#if selectedCastIds.size > 0}
            <div class="container mx-auto px-4 py-8 border-t border-gray-200">
                <h2 class="text-2xl font-bold mb-4">Movies with Selected Cast</h2>
                {#if isCastMoviesLoading || !hasPerformedSearch}
                    <div class="flex justify-center items-center py-8">
                        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                    </div>
                {:else if castMoviesError}
                    <div class="text-red-500 text-center p-4">{castMoviesError}</div>
                {:else if castMovies.length > 0}
                    <div class="space-y-4">
                        {#each castMovies as castMovie (castMovie.id)}
                            {#if castMovie.id !== movie?.id}
                                <a
                                    href="/movie/{castMovie.id}"
                                    class="flex items-start gap-4 p-4 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow"
                                    use:observeMovie={castMovie}
                                >
                                    <div class="w-24 h-36 flex-shrink-0">
                                        {#if castMovie.posterPath}
                                            <img
                                                src={castMovie.posterPath}
                                                alt={castMovie.title}
                                                class="w-full h-full object-cover rounded"
                                            />
                                        {:else}
                                            <div class="w-full h-full bg-gray-200 rounded flex items-center justify-center">
                                                <span class="text-gray-400">No poster</span>
                                            </div>
                                        {/if}
                                    </div>
                                    <div class="flex-1 min-w-0">
                                        <h3 class="text-lg font-medium text-gray-900">
                                            {castMovie.title}
                                            <span class="text-sm text-gray-500 ml-2">
                                                ({new Date(castMovie.releaseDate).getFullYear()})
                                            </span>
                                        </h3>
                                        <p class="text-sm text-gray-600 mt-1">
                                            Starring: {getSelectedCastInMovie(castMovie.castIds)}
                                        </p>
                                        {#if castMovie.isLoading}
                                            <div class="flex items-center gap-2 mt-2">
                                                <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                                                <span class="text-sm text-gray-500">Loading details...</span>
                                            </div>
                                        {:else if castMovie.overview}
                                            <p class="text-sm text-gray-700 mt-2 line-clamp-2">
                                                {castMovie.overview}
                                            </p>
                                        {/if}
                                    </div>
                                </a>
                            {/if}
                        {/each}
                    </div>
                {:else}
                    <p class="text-gray-500 text-center py-8">No other movies found with the selected cast members.</p>
                {/if}
            </div>
        {/if}
    {/if}
</div>

<style>
    .selected {
        transform: translateY(-2px);
    }
</style>
