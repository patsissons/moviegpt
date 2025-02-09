<script lang="ts">
  import dayjs from 'dayjs';
  import { store, type Watched } from '$lib/watched';

  export let movie: Watched;
  export let onUpdated: ((movie: Watched) => void) | undefined = undefined;

  $: watchedOn = dayjs(movie.watchedOn);
  $: daysAgo = dayjs().diff(watchedOn, 'days');

  function formatTitle(movie: Watched) {
    if (movie.title && movie.year) {
      return `${movie.year} ${movie.title}`;
    } else if (movie.title) {
      return movie.title;
    } else {
      return `TMDB ID: ${movie.id}`;
    }
  }

  function handleWatchedOnChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const date = dayjs(input.value);
    if (date.isValid()) {
      const watchedOn = date.format('YYYY-MM-DD');
      movie = { ...movie, watchedOn };
      store.set(movie);
      onUpdated?.(movie);
    }
  }
</script>

<tr>
  <td>
    <a href={`/movie/${movie.id}`}>
      <h3 class="text-lg font-medium text-gray-800 hover:text-amber-500">
        {formatTitle(movie)}
      </h3>
    </a>
  </td>
  <td class="flex flex-col md:flex-row items-center gap-1">
    <input
      class="entry-date-input bg-transparent font-mono text-sm focus:bg-transparent"
      type="date"
      value={watchedOn.format('YYYY-MM-DD')}
      on:change={handleWatchedOnChange}
    />
    <span class="text-sm text-gray-500">({daysAgo} day{daysAgo === 1 ? '' : 's'} ago)</span>
  </td>
</tr>

<style lang="postcss">
  .entry-date-input::-webkit-calendar-picker-indicator {
    @apply -ml-2 rounded-md bg-indigo-100;
  }

  .entry-date-input::-webkit-calendar-picker-indicator:hover {
    @apply cursor-pointer bg-indigo-200;
  }
</style>
