<script lang="ts">
  import { store } from '$lib/watched';

  export let title: string;
  export let mode: 'export' | 'import';
  export let importData = '';

  let data = '';
  let dialog: HTMLDialogElement;

  $: if (mode === 'import' && importData) {
    handleOpen();
  }

  function handleOpen() {
    if (mode === 'import' && importData) {
      data = atob(importData);
    } else if (mode === 'export') {
      data = store.exportAll();
    }

    dialog?.showModal();
  }

  function handleClose() {
    dialog?.close();
  }
</script>

<slot onOpen={handleOpen} onClose={handleClose} />

<dialog
  bind:this={dialog}
  class="my-8 w-full max-w-2xl rounded-lg p-0 backdrop:bg-black/60 backdrop:backdrop-blur-sm"
  on:close={handleClose}
>
  <div class="flex h-[80vh] flex-col">
    <!-- Header -->
    <div class="flex items-center justify-between border-b border-gray-200 px-4 py-2">
      <h2 class="text-xl font-semibold">{title}</h2>
      <button
        class="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
        on:click={handleClose}
        aria-label="Close"
      >
        <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path
            fill-rule="evenodd"
            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
            clip-rule="evenodd"
          />
        </svg>
      </button>
    </div>

    <!-- Scrollable Content -->
    <div class="flex-1 p-4">
      <textarea
        class="h-full w-full resize-none rounded border border-gray-300 p-2 font-mono text-sm"
        readonly={mode === 'export'}
        bind:value={data}
      ></textarea>
    </div>

    <!-- Footer -->
    <div class="flex justify-end gap-2 border-t border-gray-200 px-4 py-2">
      <button
        class="rounded-lg bg-gray-100 px-4 py-2 text-gray-700 hover:bg-gray-200"
        on:click={handleClose}
      >
        Close
      </button>

      <slot name="actions" {data} onClose={handleClose} />
    </div>
  </div>
</dialog>

<style>
  dialog[open] {
    animation: zoom 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  @keyframes zoom {
    from {
      transform: scale(0.95);
      opacity: 0;
    }
    to {
      transform: scale(1);
      opacity: 1;
    }
  }
</style>
