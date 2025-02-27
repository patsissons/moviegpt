<script lang="ts">
  import dayjs from 'dayjs';
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { store as watchedStore, type Watched } from '$lib/watched';
  import type { PageData } from './$types';

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

  export let data: PageData;
  let movie: Movie = data.movie;
  let error: string | null = null;
  let selectedCastIds = new Set<number>(data.selectedCastIds);
  let castMovies: CastMovie[] = data.castMovies;
  let isCastMoviesLoading = false;
  let hasPerformedSearch = data.castMovies.length > 0;
  let castMoviesError: string | null = null;
  let castSearchTimer: NodeJS.Timeout;
  let observers = new Map<number, IntersectionObserver>();
  let sortBy: SortBy = data.sortBy;

  // Update URL when selection or sort changes
  $: if (browser) {
    const url = new URL(window.location.href);
    if (selectedCastIds.size > 0) {
      url.searchParams.set('cast', Array.from(selectedCastIds).join(','));
      url.searchParams.set('sort', sortBy);
    } else {
      url.searchParams.delete('cast');
      url.searchParams.delete('sort');
    }
    goto(url.toString(), { replaceState: true, keepFocus: true, noScroll: true });
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
      castMovies = sortCastMovies(data.results, sortBy);
    } catch {
      castMoviesError = 'Failed to load cast movies';
      castMovies = [];
    } finally {
      isCastMoviesLoading = false;
      hasPerformedSearch = true;
    }
  }

  function sortCastMovies(movies: CastMovie[], sort: SortBy): CastMovie[] {
    return [...movies].sort((a, b) => {
      // First sort by number of matching cast members
      const castDiff = b.castIds.length - a.castIds.length;
      if (castDiff !== 0) return castDiff;

      // Then sort by selected criteria
      if (sort === 'year') {
        return new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime();
      } else {
        return b.vote - a.vote;
      }
    });
  }

  // Watch for sort changes and resort movies
  $: if (castMovies.length > 0) {
    castMovies = sortCastMovies(castMovies, sortBy);
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

  function updateSort(newSort: SortBy) {
    sortBy = newSort;
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

  function formatCast(castIds: Set<number>): string {
    if (castIds.size >= 5) return `${castIds.size} cast`;

    return Array.from(castIds)
      .map((id) => movie?.cast.find((member) => member.id === id)?.name)
      .join(', ');
  }

  function toggleWatched() {
    if (!movie) return;

    const { id, title, releaseDate } = movie;
    const year = new Date(releaseDate).getFullYear();

    if (watched) {
      watchedStore.remove(id);
    } else {
      watchedStore.set({ id, title, year, watchedOn: dayjs().format('YYYY-MM-DD') });
    }

    reloadWatched();
  }

  let watched: Watched | undefined;

  function reloadWatched() {
    if (!movie) return;

    watched = watchedStore.get(movie.id);

    return watched;
  }

  onMount(() => {
    return () => {
      clearTimeout(castSearchTimer);
      // Clean up all observers
      observers.forEach((observer) => observer.disconnect());
      observers.clear();
    };
  });

  $: reloadWatched();

  // Update document title when movie changes
  $: if (browser && movie) {
    const year = new Date(movie.releaseDate).getFullYear();
    const castCount = selectedCastIds.size;
    let title = `${movie.title} (${year})`;

    if (castCount > 0) {
      title = `${title} — ${castCount} Cast`;
    }

    document.title = title;
  } else if (browser) {
    document.title = 'MovieGPT';
  }

  function getMetaDescription(movie: Movie, selectedCastIds: Set<number>): string {
    let description = `${movie.title} (${new Date(movie.releaseDate).getFullYear()}) • ★ ${movie.rating.toFixed(1)} • ${formatRuntime(movie.runtime)}`;

    const selectedCastNames = movie.cast
      .filter((member) => selectedCastIds.has(member.id))
      .map((member) => member.name);
    if (selectedCastNames.length > 0) {
      description += `\nMovies with: ${selectedCastNames.join(', ')}`;
    }

    return description;
  }
</script>

<svelte:head>
  {#if movie}
    <meta property="og:title" content={movie.title} />
    <meta property="og:description" content={getMetaDescription(movie, selectedCastIds)} />
    <meta name="twitter:title" content={movie.title} />
    <meta name="twitter:description" content={getMetaDescription(movie, selectedCastIds)} />
    {#if movie.backdropPath}
      <meta property="og:image" content={movie.backdropPath} />
      <meta name="twitter:image" content={movie.backdropPath} />
    {/if}
  {:else}
    <meta property="og:title" content="MovieGPT - Discover Movies Through Cast Connections" />
    <meta
      property="og:description"
      content="Explore movies and discover new films through cast member connections. Find movies where your favorite actors work together."
    />
    <meta name="twitter:title" content="MovieGPT - Discover Movies Through Cast Connections" />
    <meta
      name="twitter:description"
      content="Explore movies and discover new films through cast member connections. Find movies where your favorite actors work together."
    />
    <meta property="og:image" content="https://movies.place/og-image.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
  {/if}
  <meta property="og:url" content={$page.url.href} />
</svelte:head>

<div>
  {#if !data.movie}
    <div class="flex min-h-screen items-center justify-center">
      <div class="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-500"></div>
    </div>
  {:else if error}
    <div class="p-4 text-center text-red-500">{error}</div>
  {:else}
    <div class="relative">
      <div class="absolute inset-0 h-[440px]">
        {#if data.movie.backdropPath}
          <img
            src={data.movie.backdropPath}
            alt={data.movie.title}
            class="w-full h-full object-cover object-top"
          />
        {/if}
        <div class="absolute h-full inset-0 bg-black/40"></div>
      </div>

      <div class="container z-20 mx-auto px-4 py-8">
        <div class="flex flex-col items-start gap-8 md:flex-row">
          <!-- Movie Poster -->
          <div class="relative w-64 flex-shrink-0 overflow-hidden rounded-lg shadow-xl">
            {#if data.movie.posterPath}
              <img src={data.movie.posterPath} alt={data.movie.title} class="w-full" />
            {:else}
              <div class="flex h-96 w-full items-center justify-center bg-gray-200">
                <span class="text-gray-400">No poster</span>
              </div>
            {/if}
            <div class="absolute bottom-0 left-0 right-0">
              <button
                class="w-full px-2 py-1 font-medium text-gray-200 hover:text-amber-300 {watched
                  ? "bg-indigo-500/90 after:content-['Watched'] hover:after:content-['Mark_unwatched']"
                  : "bg-gray-500/90 after:content-['Unwatched'] hover:after:content-['Mark_watched']"}"
                aria-label={watched ? 'Mark unwatched' : 'Mark watched'}
                on:click={toggleWatched}
              ></button>
            </div>
          </div>

          <!-- Movie Details -->
          <div class="flex-1 z-20 {data.movie.backdropPath ? 'md:text-white' : 'text-gray-900'}">
            <h1 class="mb-4 text-4xl font-bold">{data.movie.title}</h1>
            <div class="mb-4 flex flex-wrap items-center gap-4">
              <span
                class="inline-flex items-center rounded border border-black/65 bg-yellow-400 px-2 py-1 text-black"
              >
                ★ {data.movie.rating.toFixed(1)}
              </span>
              <a
                class="inline-flex items-center rounded border border-black/65 bg-cyan-400 px-2 py-1 text-black hover:shadow-md hover:brightness-110"
                href={`https://www.themoviedb.org/movie/${data.movie.id}`}
                target="_blank"
              >
                TMDB
              </a>
              {#if data.movie.imdbId}
                <a
                  class="inline-flex items-center rounded border border-black/65 bg-cyan-400 px-2 py-1 text-black hover:shadow-md hover:brightness-110"
                  href={`https://www.imdb.com/title/${data.movie.imdbId}`}
                  target="_blank"
                >
                  IMDB
                </a>
              {/if}
              <span
                class="inline-flex items-center rounded border border-black/65 bg-gray-200 px-2 py-1 text-black"
              >
                {new Date(data.movie.releaseDate).getFullYear()}
              </span>
              <span
                class="text-md text-gray-500 {data.movie.backdropPath ? 'md:text-gray-200' : ''}"
                >{formatRuntime(data.movie.runtime)}</span
              >
            </div>
            <p
              class="mb-8 text-lg text-gray-700 {data.movie.backdropPath ? 'md:text-gray-200' : ''}"
            >
              {data.movie.overview}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Cast Section -->
    <div class="container mx-auto px-4 py-8 z-20">
      <div class="mb-4 flex items-baseline justify-between gap-2">
        <h2 class="text-2xl font-bold">{data.movie.cast.length} Cast</h2>
        <span class="text-sm text-gray-500">
          {#if selectedCastIds.size > 0}
            Seaching with {selectedCastIds.size} cast
          {:else}
            Select cast to search for related movies
          {/if}
        </span>
      </div>
      <div class="overflow-x-auto rounded-lg bg-white p-4 shadow-sm">
        <div class="flex items-start gap-4" style="min-width: min-content">
          {#each data.movie.cast as member (member.id)}
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
        <div class="mb-4 flex items-end justify-between gap-4">
          <h2 class="text-2xl font-bold">
            {castMovies.length} Movies with {formatCast(selectedCastIds)}
          </h2>
          <div class="flex rounded-lg border border-gray-200 bg-white">
            <button
              class="w-14 px-3 py-1 text-center text-sm {sortBy === 'year'
                ? 'bg-blue-500 text-white'
                : 'text-gray-600 hover:bg-gray-100'} rounded-l-lg transition-colors"
              on:click={() => updateSort('year')}
            >
              Year
            </button>
            <button
              class="w-14 px-3 py-1 text-center text-sm {sortBy === 'rating'
                ? 'bg-blue-500 text-white'
                : 'text-gray-600 hover:bg-gray-100'} rounded-r-lg transition-colors"
              on:click={() => updateSort('rating')}
            >
              ★
            </button>
          </div>
        </div>

        {#if isCastMoviesLoading || !hasPerformedSearch}
          <div class="flex items-center justify-center py-8">
            <div class="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-500"></div>
          </div>
        {:else if castMoviesError}
          <div class="p-4 text-center text-red-500">{castMoviesError}</div>
        {:else if castMovies.length > 0}
          <div class="space-y-4">
            {#each castMovies as castMovie (castMovie.id)}
              {#if castMovie.id !== data.movie?.id}
                {@const castMovieWatched = watchedStore.has(castMovie.id)}
                <a
                  href="/movie/{castMovie.id}"
                  class="flex items-start gap-4 rounded-lg bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
                  use:observeMovie={castMovie}
                >
                  <div class="relative h-36 w-24 flex-shrink-0 overflow-hidden rounded">
                    {#if castMovie.posterPath}
                      <img
                        src={castMovie.posterPath}
                        alt={castMovie.title}
                        class="h-full w-full object-cover"
                      />
                    {:else}
                      <div
                        class="flex h-full w-full items-center justify-center bg-gray-200"
                      >
                        <span class="text-gray-400">No poster</span>
                      </div>
                    {/if}
                    <div class="absolute bottom-0 left-0 right-0">
                      <p
                        class="w-full px-2 py-1 text-xs text-center font-medium text-gray-200 {castMovieWatched
                          ? "bg-indigo-500/90"
                          : "bg-gray-500/90"}"
                      >
                        {castMovieWatched ? 'Watched' : 'Unwatched'}
                      </p>
                    </div>
                  </div>
                  <div class="min-w-0 flex-1">
                    <h3 class="text-lg font-medium text-gray-900">
                      <span>{castMovie.title}</span>
                    </h3>
                    <h4 class="flex flex-wrap items-center gap-2">
                      <span
                        class="inline-flex items-center rounded border border-black/65 bg-yellow-400 px-2 py-1 text-black"
                      >
                        ★ {castMovie.vote.toFixed(1)}
                      </span>
                      <button
                        class="inline-flex items-center rounded border border-black/65 bg-cyan-400 px-2 py-1 text-black hover:shadow-md hover:brightness-110"
                        on:click={(e) => {
                          e.preventDefault();
                          window.open(`https://www.themoviedb.org/movie/${castMovie.id}`, '_blank');
                        }}
                      >
                        TMDB
                      </button>
                      {#if castMovie.imdbId}
                        <button
                          class="inline-flex items-center rounded border border-black/65 bg-cyan-400 px-2 py-1 text-black hover:shadow-md hover:brightness-110"
                          on:click={(e) => {
                            e.preventDefault();
                            window.open(`https://www.imdb.com/title/${castMovie.imdbId}`, '_blank');
                          }}
                        >
                          IMDB
                        </button>
                      {/if}
                      <span
                        class="inline-flex items-center rounded border border-black/65 bg-gray-200 px-2 py-1 text-black"
                      >
                        {new Date(castMovie.releaseDate).getFullYear()}
                      </span>
                      {#if castMovie.runtime}
                        <span class="text-md text-gray-500">
                          {formatRuntime(castMovie.runtime)}
                        </span>
                      {/if}
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
