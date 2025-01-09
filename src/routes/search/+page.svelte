<script lang="ts">
    import { page } from '$app/stores';
    import { goto } from '$app/navigation';
    import { onMount } from 'svelte';
    import { browser } from '$app/environment';

    let searchInput: string = '';
    let debounceTimer: NodeJS.Timeout;
    let isLoading = false;
    let movies: Array<{ id: number; title: string; posterPath: string | null }> = [];
    let error: string | null = null;

    // Initialize search input from URL query parameter
    $: if (browser && $page.url.searchParams.get('q')) {
        searchInput = $page.url.searchParams.get('q') || '';
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
        } catch (e) {
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

    onMount(() => {
        return () => {
            clearTimeout(debounceTimer);
        };
    });
</script>

<div class="flex flex-col items-center justify-start min-h-screen bg-gray-100 p-4">
    <div class="w-full max-w-xl mb-8">
        <input
            type="text"
            bind:value={searchInput}
            on:input={handleInput}
            placeholder="Search for movies..."
            class="w-full px-4 py-2 text-lg border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
    </div>

    {#if isLoading}
        <div class="flex justify-center items-center">
            <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
    {:else if error}
        <div class="text-red-500 text-center">{error}</div>
    {:else if movies.length > 0}
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6 max-w-6xl mx-auto">
            {#each movies as movie (movie.id)}
                <a
                    href="/movie/{movie.id}"
                    class="flex flex-col items-center transform transition-transform hover:scale-105"
                >
                    <div class="w-48 h-72 mb-2">
                        {#if movie.posterPath}
                            <img
                                src={movie.posterPath}
                                alt={movie.title}
                                class="w-full h-full object-cover rounded-lg shadow-lg"
                            />
                        {:else}
                            <div class="w-full h-full bg-gray-200 rounded-lg flex items-center justify-center">
                                <span class="text-gray-400">No poster</span>
                            </div>
                        {/if}
                    </div>
                    <h3 class="text-center text-sm font-medium text-gray-800 max-w-[12rem] truncate">
                        {movie.title}
                    </h3>
                </a>
            {/each}
        </div>
    {/if}
</div>
