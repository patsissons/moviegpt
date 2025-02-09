<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { store, type Watched } from '$lib/watched';
  import Entry from './entry.svelte';
  import Modal from './modal.svelte';

  let watched: Watched[];
  let importData = '';

  $: reload();

  function reload() {
    watched = store.load();
  }

  function reset() {
    if (
      !confirm(
        'Are you sure you want to reset the watched list? This action cannot be undone. use export to make a backup first.',
      )
    )
      return;

    store.clear();
    reload();
  }

  function handleCopyList(exportData: string) {
    navigator.clipboard.writeText(exportData);
  }

  function handleCopyImportUrl(exportData: string) {
    const encoded = btoa(exportData);
    navigator.clipboard.writeText(`${window.location.origin}/watched?import=${encoded}`);
  }

  function handleImportList(exportData: string, onClose: () => void) {
    store.importAll(exportData);
    reload();
    goto('/watched', { replaceState: true, noScroll: true });
    onClose();
  }

  onMount(() => {
    importData = page.url.searchParams.get('import') || '';
  });
</script>

<div class="my-4 grid grid-rows-[auto_auto_1fr] place-items-center gap-4">
  <h1 class="text-2xl font-bold">Watched list</h1>

  <div class="flex gap-2">
    <button
      class="inline-flex items-center rounded border border-black/65 bg-indigo-400/75 px-2 py-1 text-black hover:shadow-md hover:brightness-110"
      on:click={reload}
    >
      Reload
    </button>
    <Modal mode="export" title="Export Watched List" let:onOpen>
      <button
        class="inline-flex items-center rounded border border-black/65 bg-indigo-400/75 px-2 py-1 text-black hover:shadow-md hover:brightness-110"
        on:click={onOpen}
      >
        Export
      </button>

      <svelte:fragment slot="actions" let:data>
        <button
          class="rounded-lg bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
          on:click={() => handleCopyList(data)}
        >
          Copy List
        </button>
        <button
          class="rounded-lg bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
          on:click={() => handleCopyImportUrl(data)}
        >
          Copy Import Url
        </button>
      </svelte:fragment>
    </Modal>
    <Modal mode="import" title="Import Watched List" {importData} let:onOpen>
      <button
        class="inline-flex items-center rounded border border-black/65 bg-indigo-400/75 px-2 py-1 text-black hover:shadow-md hover:brightness-110"
        on:click={onOpen}
      >
        Import
      </button>

      <svelte:fragment slot="actions" let:data let:onClose>
        <button
          class="rounded-lg bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
          on:click={() => handleImportList(data, onClose)}
        >
          Import List
        </button>
      </svelte:fragment>
    </Modal>
    <button
      class="inline-flex items-center rounded border border-black/65 bg-indigo-400/75 px-2 py-1 text-black hover:shadow-md hover:brightness-110"
      on:click={reset}
    >
      Reset
    </button>
  </div>

  <table class="border-separate border-spacing-x-2 border-spacing-y-1 self-start">
    <thead>
      <tr>
        <th>Title</th>
        <th>Watched on</th>
      </tr>
    </thead>
    <tbody>
      {#each watched as movie (movie.id)}
        <Entry {movie} onUpdated={reload} />
      {/each}
    </tbody>
  </table>
</div>
