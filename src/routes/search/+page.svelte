<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';

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

  // Watch for URL query parameter changes and trigger search
  $: if (browser) {
    const queryParam = $page.url.searchParams.get('q');
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

  function handleInput() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const url = new URL(window.location.href);
      if (searchInput.trim()) {
        url.searchParams.set('q', searchInput);
      } else {
        url.searchParams.delete('q');
      }
      goto(url.toString(), { replaceState: true });
    }, 1500);
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

<div class="flex min-h-screen flex-col items-center justify-start bg-gray-100 p-4">
  <div class="mb-8 w-full max-w-xl">
    <input
      type="text"
      bind:value={searchInput}
      on:input={handleInput}
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
        <a
          href="/movie/{movie.id}"
          class="flex transform flex-col items-center transition-transform hover:scale-105"
        >
          <div class="relative mb-2 h-72 w-48">
            {#if movie.posterPath}
              <img
                src={movie.posterPath}
                alt={movie.title}
                class="h-full w-full rounded-lg object-cover shadow-lg"
              />
            {:else}
              <div class="flex h-full w-full items-center justify-center rounded-lg bg-gray-200">
                <span class="text-gray-400">No poster</span>
              </div>
            {/if}
            {#if movie.voteAverage && movie.voteCount}
              <div class="absolute -top-1 -right-1">
                <span class="inline-flex items-center rounded {movie.voteCount > 100 ? 'bg-yellow-400' : 'bg-gray-200'} px-2 py-1 text-black border border-black/65 shadow-md">
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
