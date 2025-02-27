<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { store as watchedStore } from '$lib/watched';

  type SearchMovie = {
    id: number;
    title: string;
    posterPath?: string;
    releaseDate?: string;
    voteAverage?: number;
    voteCount?: number;
  };

  let searchInput: string = '';
  let debounceTimer: NodeJS.Timeout;
  let isLoading = false;
  let movies: SearchMovie[] = [];
  let error: string | null = null;

  $: if (browser) {
    const queryParam = $page.url.searchParams.get('q');
    if (queryParam) {
      document.title = `Search - ${queryParam}`;
    } else {
      document.title = 'Search - MovieGPT';
    }
  }

  $: queryParam = $page.url.searchParams.get('q');

  // Watch for URL query parameter changes and trigger search
  $: if (browser) {
    if (queryParam) {
      searchMovies(queryParam);
    } else {
      movies = [];
    }
  }

  async function searchMovies(query: string) {
    isLoading = true;
    error = null;
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      if (!response.ok) throw new Error('Search failed');
      const data = await response.json();
      movies = data.results;
    } catch {
      error = 'Failed to search movies';
      movies = [];
    } finally {
      isLoading = false;
    }
  }

  function updateSearchParam() {
    const url = new URL(window.location.href);
    if (searchInput.trim()) {
      url.searchParams.set('q', searchInput);
    } else {
      url.searchParams.delete('q');
    }
    goto(url.toString(), { replaceState: true, keepFocus: true, noScroll: true });
  }

  function handleInput() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => updateSearchParam(), 1500);
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      clearTimeout(debounceTimer);
      updateSearchParam();
    }
  }

  function formatTitle(movie: SearchMovie) {
    if (!movie.releaseDate) return movie.title;

    return `(${new Date(movie.releaseDate).getFullYear()}) ${movie.title}`;
  }

  onMount(() => {
    return () => {
      clearTimeout(debounceTimer);
    };
  });
</script>

<svelte:head>
  {#if queryParam}
    <meta property="og:title" content={`Searching for ${queryParam} - MovieGPT`} />
    <meta
      property="og:description"
      content={`Searching for movies with "${queryParam}" - MovieGPT`}
    />
    <meta name="twitter:title" content={`Searching for ${queryParam} - MovieGPT`} />
    <meta
      name="twitter:description"
      content={`Searching for movies with "${queryParam}" - MovieGPT`}
    />
  {:else}
    <meta property="og:title" content="Search - MovieGPT" />
    <meta property="og:description" content="Search for movies - MovieGPT" />
    <meta name="twitter:title" content="Search - MovieGPT" />
    <meta name="twitter:description" content="Search for movies - MovieGPT" />
  {/if}

  <meta property="og:image" content="https://movies.place/og-image.png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:url" content={$page.url.href} />
</svelte:head>

<div class="flex flex-col items-center justify-start p-4">
  <div class="mb-8 w-full max-w-xl">
    <input
      type="text"
      bind:value={searchInput}
      on:input={handleInput}
      on:keydown={handleKeyDown}
      placeholder="Search for movies..."
      class="w-full rounded-lg border border-gray-300 px-4 py-2 text-lg focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
  </div>

  {#if isLoading}
    <div class="flex items-center justify-center">
      <div class="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-500"></div>
    </div>
  {:else if error}
    <div class="text-center text-red-500">{error}</div>
  {:else if movies.length > 0}
    <div
      class="mx-auto grid max-w-6xl grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5"
    >
      {#each movies as movie (movie.id)}
        {@const movieWatched = watchedStore.has(movie.id)}
        <a
          href="/movie/{movie.id}"
          class="flex transform flex-col items-center transition-transform hover:scale-105"
        >
          <div class="relative mb-2">
            <div class="relative h-72 w-48 rounded-lg overflow-hidden">
              {#if movie.posterPath}
                <img
                  src={movie.posterPath}
                  alt={movie.title}
                  class="h-full w-full object-cover shadow-lg"
                />
              {:else}
                <div class="flex h-full w-full items-center justify-center bg-gray-200">
                  <span class="text-gray-400">No poster</span>
                </div>
              {/if}
              <div class="absolute bottom-0 left-0 right-0">
                <p
                  class="w-full px-2 py-1 text-xs text-center font-medium text-gray-200 {movieWatched
                    ? "bg-indigo-500/90"
                    : "bg-gray-500/90"}"
                >
                  {movieWatched ? 'Watched' : 'Unwatched'}
                </p>
              </div>
            </div>
            {#if movie.voteAverage && movie.voteCount}
              <div class="absolute -right-1 -top-1">
                <span
                  class="inline-flex items-center rounded {movie.voteCount > 100
                    ? 'bg-yellow-400'
                    : 'bg-gray-200'} border border-black/65 px-2 py-1 text-black shadow-md"
                >
                  ★ {movie.voteAverage.toFixed(1)}
                </span>
              </div>
            {/if}
          </div>
          <h3 class="max-w-[12rem] truncate text-center text-sm font-medium text-gray-800">
            {formatTitle(movie)}
          </h3>
        </a>
      {/each}
    </div>
  {/if}
</div>
