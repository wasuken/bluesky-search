<script>
  import Modal from "./components/ContentModal.svelte";
  import {fileIdUpdate, open, isOpen} from "./stores/index.js";

  const baseAPI = "HOST";
  const baseAPIURL = `http://${baseAPI}/api/v1`;
  let query = "";
  let promise = Promise.resolve([]);

  async function searchReq() {
    const fetchURL = new URL(`${baseAPIURL}/search?q=${query}`);
    const resp = await fetch(fetchURL);
    if (resp.ok) {
      return resp.json();
    } else {
      throw new Error("Invalid Response.");
    }
  }
  function handleSearch() {
    promise = searchReq();
  }
  function handleFileRead(id) {
	fileIdUpdate(id);
	open();
  }
</script>

<div>
  <nav class="navbar navbar-expand-lg navbar-light bg-light">
    <a class="navbar-brand" href="/">Bluesky Search</a>
    <div class="navbar-collapse">
      <input
        class="form-control mr-sm-2"
        type="search"
        bind:value={query}
        placeholder="Search"
        aria-label="Search" />
      <button
        on:click={handleSearch}
        class="btn btn-outline-success my-2 my-sm-0"
        type="submit">Search</button>
    </div>
  </nav>

  <Modal />

  {#await promise}
    <p>please search...</p>
  {:then data}
    <section class="main">
      <div class="container">
        <div class="row">
          {#each data.articles ?? [] as article}
            <div class="card col-3">
              <div class="card-body">
                <h5 class="card-title">{article.title}</h5>
                <p class="card-text">{article.parts_of_content}...</p>
                <button
                  on:click={() => handleFileRead(article.id)}
                  class="btn btn-primary">Read</button>
              </div>
            </div>
          {/each}
        </div>
      </div>
    </section>
  {:catch error}
    <p style="color: red">{error.message}</p>
  {/await}
  <footer class="footer">footer</footer>
</div>
