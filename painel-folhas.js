<<<<<<< HEAD
// painel-folhas.js — Lógica da secção de folhas no painel

window.Cancioneiro = window.Cancioneiro || {};

Cancioneiro.painelFolhas = (function () {

  let ordemAtual = "data"; // "data" ou "alfa"

  function ordenarFolhas(folhas) {
    if (ordemAtual === "alfa") {
      return [...folhas].sort((a, b) => a.titulo.localeCompare(b.titulo, "pt"));
    }
    // Por data — folhas sem data ficam no fim
    return [...folhas].sort((a, b) => {
      if (!a.data && !b.data) return 0;
      if (!a.data) return 1;
      if (!b.data) return -1;
      return b.data.localeCompare(a.data); // mais recente primeiro
    });
  }

  function renderizarLista() {
    const lista = document.getElementById("lista-folhas-painel");
    if (!lista) return;

    const folhas = ordenarFolhas(Cancioneiro.folhas.listar());
    lista.innerHTML = "";

    if (folhas.length === 0) {
      lista.innerHTML = "<li class='folha-painel-vazia'>Ainda não há folhas.</li>";
      return;
    }

    for (const folha of folhas) {
      const dataFormatada = folha.data
        ? new Date(folha.data + "T00:00:00").toLocaleDateString("pt-PT", {
            day: "numeric", month: "short", year: "numeric"
          })
        : "";

      const li = document.createElement("li");
      li.innerHTML = `
        <div class="folha-painel-info">
          <div class="folha-painel-titulo">${folha.titulo}</div>
          ${dataFormatada ? `<div class="folha-painel-data">${dataFormatada}</div>` : ""}
        </div>
        <div class="folha-painel-acoes">
          <button class="btn-editar-folha" data-id="${folha.id}" title="Editar nome">✎</button>
          <button class="btn-apagar-folha" data-id="${folha.id}" title="Apagar">✕</button>
        </div>
      `;

      // Clique na info → abre a folha
      li.querySelector(".folha-painel-info").addEventListener("click", () => {
        window.location.href = `folha.html?id=${folha.id}`;
      });

      // Editar título inline
      li.querySelector(".btn-editar-folha").addEventListener("click", (e) => {
        e.stopPropagation();
        const novoTitulo = prompt("Novo título:", folha.titulo);
        if (novoTitulo && novoTitulo.trim()) {
          folha.titulo = novoTitulo.trim();
          Cancioneiro.folhas.guardar(folha);
          renderizarLista();
        }
      });

      // Apagar folha
      li.querySelector(".btn-apagar-folha").addEventListener("click", (e) => {
        e.stopPropagation();
        if (confirm(`Apagar a folha "${folha.titulo}"?`)) {
          Cancioneiro.folhas.apagar(folha.id);
          renderizarLista();
        }
      });

      lista.appendChild(li);
    }
  }

  function init() {
    // Botão de nova folha
    const btnNova = document.getElementById("btn-nova-folha-painel");
    if (btnNova) {
      btnNova.addEventListener("click", () => {
        const novaFolha = Cancioneiro.folhas.criar("Nova folha", "", "");
        window.location.href = `folha.html?id=${novaFolha.id}`;
      });
    }

    // Botões de ordenação
    const btnData = document.getElementById("btn-ordem-data");
    const btnAlfa = document.getElementById("btn-ordem-alfa");

    if (btnData && btnAlfa) {
      btnData.addEventListener("click", () => {
        ordemAtual = "data";
        btnData.classList.add("ativo");
        btnAlfa.classList.remove("ativo");
        renderizarLista();
      });

      btnAlfa.addEventListener("click", () => {
        ordemAtual = "alfa";
        btnAlfa.classList.add("ativo");
        btnData.classList.remove("ativo");
        renderizarLista();
      });
    }

    renderizarLista();
  }

  return { init, renderizarLista };

=======
// painel-folhas.js — Lógica da secção de folhas no painel

window.Cancioneiro = window.Cancioneiro || {};

Cancioneiro.painelFolhas = (function () {

  let ordemAtual = "data"; // "data" ou "alfa"

  function ordenarFolhas(folhas) {
    if (ordemAtual === "alfa") {
      return [...folhas].sort((a, b) => a.titulo.localeCompare(b.titulo, "pt"));
    }
    // Por data — folhas sem data ficam no fim
    return [...folhas].sort((a, b) => {
      if (!a.data && !b.data) return 0;
      if (!a.data) return 1;
      if (!b.data) return -1;
      return b.data.localeCompare(a.data); // mais recente primeiro
    });
  }

  function renderizarLista() {
    const lista = document.getElementById("lista-folhas-painel");
    if (!lista) return;

    const folhas = ordenarFolhas(Cancioneiro.folhas.listar());
    lista.innerHTML = "";

    if (folhas.length === 0) {
      lista.innerHTML = "<li class='folha-painel-vazia'>Ainda não há folhas.</li>";
      return;
    }

    for (const folha of folhas) {
      const dataFormatada = folha.data
        ? new Date(folha.data + "T00:00:00").toLocaleDateString("pt-PT", {
            day: "numeric", month: "short", year: "numeric"
          })
        : "";

      const li = document.createElement("li");
      li.innerHTML = `
        <div class="folha-painel-info">
          <div class="folha-painel-titulo">${folha.titulo}</div>
          ${dataFormatada ? `<div class="folha-painel-data">${dataFormatada}</div>` : ""}
        </div>
        <div class="folha-painel-acoes">
          <button class="btn-editar-folha" data-id="${folha.id}" title="Editar nome">✎</button>
          <button class="btn-apagar-folha" data-id="${folha.id}" title="Apagar">✕</button>
        </div>
      `;

      // Clique na info → abre a folha
      li.querySelector(".folha-painel-info").addEventListener("click", () => {
        window.location.href = `folha.html?id=${folha.id}`;
      });

      // Editar título inline
      li.querySelector(".btn-editar-folha").addEventListener("click", (e) => {
        e.stopPropagation();
        const novoTitulo = prompt("Novo título:", folha.titulo);
        if (novoTitulo && novoTitulo.trim()) {
          folha.titulo = novoTitulo.trim();
          Cancioneiro.folhas.guardar(folha);
          renderizarLista();
        }
      });

      // Apagar folha
      li.querySelector(".btn-apagar-folha").addEventListener("click", (e) => {
        e.stopPropagation();
        if (confirm(`Apagar a folha "${folha.titulo}"?`)) {
          Cancioneiro.folhas.apagar(folha.id);
          renderizarLista();
        }
      });

      lista.appendChild(li);
    }
  }

  function init() {
    // Botão de nova folha
    const btnNova = document.getElementById("btn-nova-folha-painel");
    if (btnNova) {
      btnNova.addEventListener("click", () => {
        const novaFolha = Cancioneiro.folhas.criar("Nova folha", "", "");
        window.location.href = `folha.html?id=${novaFolha.id}`;
      });
    }

    // Botões de ordenação
    const btnData = document.getElementById("btn-ordem-data");
    const btnAlfa = document.getElementById("btn-ordem-alfa");

    if (btnData && btnAlfa) {
      btnData.addEventListener("click", () => {
        ordemAtual = "data";
        btnData.classList.add("ativo");
        btnAlfa.classList.remove("ativo");
        renderizarLista();
      });

      btnAlfa.addEventListener("click", () => {
        ordemAtual = "alfa";
        btnAlfa.classList.add("ativo");
        btnData.classList.remove("ativo");
        renderizarLista();
      });
    }

    renderizarLista();
  }

  return { init, renderizarLista };

>>>>>>> 6ca9708 (Ligação Git)
})();