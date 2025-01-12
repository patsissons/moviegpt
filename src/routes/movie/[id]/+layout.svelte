<script lang="ts">
  import { page } from "$app/state";
</script>


{#key page.params.id}
  <slot />
{/key}
