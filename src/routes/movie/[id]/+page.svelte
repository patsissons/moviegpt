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
    vote: number;
    castIds: number[];
    cast: Record<number, string>;
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
      observers.forEach((observer) => observer.disconnect());
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
      const index = castMovies.findIndex((m) => m.id === castMovie.id);
      if (index !== -1) {
        castMovies[index] = {
          ...castMovies[index],
          ...data.movie,
          isDetailLoaded: true,
          isLoading: false,
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
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            loadCastMovieDetails(movie);
            observer.unobserve(node);
          }
        });
      },
      { rootMargin: '50px' },
    );

    observer.observe(node);
    observers.set(movie.id, observer);

    return {
      destroy() {
        observer.disconnect();
        observers.delete(movie.id);
      },
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
  function getSelectedCastInMovie(movieCast: Record<number, string>): string {
    if (!movie) return '';
    return movie.cast
      .filter((member) => member.id in movieCast)
      .map((member) => {
        const character = movieCast[member.id];
        if (!character) return member.name;

        return `${member.name} as ${character}`;
      })
      .join(', ');
  }

  onMount(() => {
    return () => {
      clearTimeout(castSearchTimer);
      // Clean up all observers
      observers.forEach((observer) => observer.disconnect());
      observers.clear();
    };
  });
</script>

<div class="min-h-screen bg-gray-100">
  {#if isLoading}
    <div class="flex min-h-screen items-center justify-center">
      <div class="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-500"></div>
    </div>
  {:else if error}
    <div class="p-4 text-center text-red-500">{error}</div>
  {:else if movie}
    <div class="relative overflow-clip">
      {#if movie.backdropPath}
        <div class="absolute inset-0 h-[50vh]">
          <div class="absolute inset-0 z-10 bg-black/50"></div>
          <img src={movie.backdropPath} alt={movie.title} class="h-full w-full object-cover" />
        </div>
      {/if}

      <div class="container relative z-20 mx-auto px-4 py-8">
        <div class="flex flex-col items-start gap-8 md:flex-row">
          <!-- Movie Poster -->
          <div class="w-64 flex-shrink-0">
            {#if movie.posterPath}
              <img src={movie.posterPath} alt={movie.title} class="w-full rounded-lg shadow-xl" />
            {:else}
              <div class="flex h-96 w-full items-center justify-center rounded-lg bg-gray-200">
                <span class="text-gray-400">No poster</span>
              </div>
            {/if}
          </div>

          <!-- Movie Details -->
          <div class="flex-1 {movie.backdropPath ? 'md:text-white' : 'text-gray-900'}">
            <h1 class="mb-4 text-4xl font-bold">{movie.title}</h1>
            <div class="mb-4 flex items-center gap-4">
              <span class="inline-flex items-center rounded bg-yellow-400 px-2 py-1 text-black">
                ★ {movie.rating.toFixed(1)}
              </span>
              <span>{new Date(movie.releaseDate).getFullYear()}</span>
              <span>{formatRuntime(movie.runtime)}</span>
            </div>
            <p class="mb-8 text-lg {movie.backdropPath ? 'md:text-gray-200' : 'text-gray-700'}">
              {movie.overview}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Cast Section -->
    <div class="container mx-auto px-4 py-8">
      <h2 class="mb-4 text-2xl font-bold">Cast</h2>
      <div class="overflow-x-auto rounded-lg bg-white p-4 shadow-sm">
        <div class="flex items-start gap-4" style="min-width: min-content">
          {#each movie.cast as member (member.id)}
            <button
              class="group w-32 flex-shrink-0 text-left transition-transform duration-200 focus:outline-none"
              class:selected={selectedCastIds.has(member.id)}
              on:click={() => toggleCastSelection(member.id)}
            >
              <div
                class="relative mb-2 h-32 w-32 transform overflow-hidden rounded-lg transition-transform duration-200 group-hover:scale-105"
              >
                {#if member.profilePath}
                  <img
                    src={member.profilePath}
                    alt={member.name}
                    class="h-full w-full object-cover shadow-md"
                  />
                {:else}
                  <div class="flex h-full w-full items-center justify-center bg-gray-200">
                    <span class="text-gray-400">No photo</span>
                  </div>
                {/if}
                {#if selectedCastIds.has(member.id)}
                  <div
                    class="absolute inset-0 rounded-lg border-2 border-blue-500 bg-blue-500/20"
                  ></div>
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
      <div class="container mx-auto border-t border-gray-200 px-4 py-8">
        <h2 class="mb-4 text-2xl font-bold">Movies with Selected Cast</h2>
        {#if isCastMoviesLoading || !hasPerformedSearch}
          <div class="flex items-center justify-center py-8">
            <div class="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-500"></div>
          </div>
        {:else if castMoviesError}
          <div class="p-4 text-center text-red-500">{castMoviesError}</div>
        {:else if castMovies.length > 0}
          <div class="space-y-4">
            {#each castMovies as castMovie (castMovie.id)}
              {#if castMovie.id !== movie?.id}
                <a
                  href="/movie/{castMovie.id}"
                  class="flex items-start gap-4 rounded-lg bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
                  use:observeMovie={castMovie}
                >
                  <div class="h-36 w-24 flex-shrink-0">
                    {#if castMovie.posterPath}
                      <img
                        src={castMovie.posterPath}
                        alt={castMovie.title}
                        class="h-full w-full rounded object-cover"
                      />
                    {:else}
                      <div
                        class="flex h-full w-full items-center justify-center rounded bg-gray-200"
                      >
                        <span class="text-gray-400">No poster</span>
                      </div>
                    {/if}
                  </div>
                  <div class="min-w-0 flex-1">
                    <h3 class="text-lg font-medium text-gray-900">
                      <span>{castMovie.title}</span>
                    </h3>
                    <h4 class="flex items-center gap-2">
                      <span class="text-md text-gray-500">
                        ({new Date(castMovie.releaseDate).getFullYear()})
                      </span>
                      <span
                        class="inline-flex items-center rounded bg-yellow-400 px-2 py-1 text-xs text-black"
                      >
                        ★ {castMovie.vote.toFixed(1)}
                      </span>
                    </h4>
                    <p class="mt-1 text-sm text-gray-600">
                      Starring: {getSelectedCastInMovie(castMovie.cast)}
                    </p>
                    {#if castMovie.isLoading}
                      <div class="mt-2 flex items-center gap-2">
                        <div
                          class="h-4 w-4 animate-spin rounded-full border-b-2 border-blue-500"
                        ></div>
                        <span class="text-sm text-gray-500">Loading details...</span>
                      </div>
                    {:else if castMovie.overview}
                      <p class="mt-2 line-clamp-2 text-sm text-gray-700">
                        {castMovie.overview}
                      </p>
                    {/if}
                  </div>
                </a>
              {/if}
            {/each}
          </div>
        {:else}
          <p class="py-8 text-center text-gray-500">
            No other movies found with the selected cast members.
          </p>
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
