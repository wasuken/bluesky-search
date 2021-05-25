<script>
  import {isOpen, open, close, fileId} from "../stores/index.js";
  const baseAPI = "HOST";
  const baseAPIURL = `http://${baseAPI}/api/v1`;

  let promise = Promise.resolve([]);

  async function readFile(id) {
    const fetchURL = new URL(`${baseAPIURL}/file?id=${id}`);
    const resp = await fetch(fetchURL);
    if (resp.ok) {
      return resp.json();
    } else {
      throw new Error("Invalid Response.");
    }
  }

  $: {
    if ($isOpen) {
      promise = readFile($fileId);
    }
  }
</script>

<style>
  .n_modal_bg {
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.5);
    position: fixed;
    top: 0;
    left: 0;
    z-index: 1;
    display: grid;
    justify-content: center;
    align-content: center;
  }
  .n_modal {
    z-index: 2;
    width: 100%;
    height: 60%;
    overflow-y: auto;
    word-break: break-all;
    background-color: rgb(0, 0, 0);
    background-color: rgba(0, 0, 0, 0.4);
  }
  .n_modal pre {
    white-space: pre-wrap;
  }
</style>

{#if $isOpen}
  {#await promise}
    <p />
  {:then data}
    <div class="n_modal_bg">
      <div class="n_modal">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">{data.title ?? ''}</h5>
            <button type="button" class="close" on:click={close}>
              <span aria-hidden="true">&times;</span>
            </button>
          </div>
          <div class="modal-body">
            <pre>
              {data.content ?? ''}
            </pre>
          </div>
          <div class="modal-footer">
            <button
              type="button"
              class="btn btn-secondary"
              on:click={close}>Close</button>
          </div>
        </div>
      </div>
    </div>
  {:catch error}
    <p style="color: red">{error.message}</p>
  {/await}
{/if}
