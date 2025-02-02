<script lang="ts">
  import { page } from '$app/stores';
  import { browser } from '$app/environment';

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
    backdropPath: string | null;
    rating: number;
    releaseDate: string;
    runtime: number;
    cast: CastMember[];
  }

  let movie: Movie | null = null;
  let selectedCastNames: string[] = [];

  // Watch for URL query parameter changes to get selected cast names
  $: if (browser) {
    const searchParams = $page.url.searchParams;
    const castParam = searchParams.get('cast');
    if (castParam) {
      selectedCastNames = castParam.split(',').map(id => {
        const member = movie?.cast?.find(m => m.id === parseInt(id));
        return member?.name || '';
      }).filter(Boolean);
    } else {
      selectedCastNames = [];
    }
  }

  async function loadMovieDetails(id: string) {
    try {
      const response = await fetch(`/api/movie/${id}`);
      if (!response.ok) throw new Error('Failed to load movie details');
      const data = await response.json();
      movie = data.movie;
    } catch (error) {
      console.error('Failed to load movie details for meta tags:', error);
    }
  }

  $: if ($page.params?.id) {
    loadMovieDetails($page.params.id);
  }

  function formatRuntime(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  }

  function getMetaDescription(): string {
    if (!movie) return '';

    let description = `${movie.title} (${new Date(movie.releaseDate).getFullYear()}) • ★ ${movie.rating.toFixed(1)} • ${formatRuntime(movie.runtime)}`;

    if (selectedCastNames.length > 0) {
      description += `\nMovies with: ${selectedCastNames.join(', ')}`;
    }

    return description;
  }

  function getOgImageUrl(): string {
    if (!movie) return '';

    const baseUrl = $page.url.origin;
    const castParam = $page.url.searchParams.get('cast');
    const ogImageUrl = new URL(`/api/movie/${movie.id}/og`, baseUrl);

    if (castParam) {
      ogImageUrl.searchParams.set('cast', castParam);
    }

    return ogImageUrl.toString();
  }
</script>

<svelte:head>
  {#if movie}
    <meta property="og:title" content={movie.title} />
    <meta property="og:description" content={getMetaDescription()} />
    <meta property="og:image" content={getOgImageUrl()} />
    <meta property="og:url" content={$page.url.href} />

    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content={movie.title} />
    <meta name="twitter:description" content={getMetaDescription()} />
    <meta name="twitter:image" content={getOgImageUrl()} />
  {/if}
</svelte:head>

<slot />
