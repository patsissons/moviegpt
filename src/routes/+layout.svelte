<script lang="ts">
  import '../app.css';

  let { children } = $props();
</script>

<div class="relative flex flex-col min-h-dvh bg-gray-100">
  <div class="flex-1">
    {@render children()}
  </div>

  <footer
    class="grid grid-flow-col place-content-center gap-4 bg-indigo-500/75 px-2 py-1 text-sm text-gray-200 z-50"
  >
    <a href="/search" class="hover:text-amber-300">Search</a>
    <a href="/watched" class="hover:text-amber-300">Watched</a>
  </footer>
</div>
