// app.js — Lógica da página principal (lista de cânticos)

/* -----------------------------------------------------------------------------
 * Carrega o índice de cânticos
 * ----------------------------------------------------------------------------- */

async function carregarCanticos() {
	const resposta = await fetch("dados/index.json");
	const canticos = await resposta.json();
	return canticos;
}

/* ------------------------------------------------------------------------------
 * SECÇÃO 2: Secção de folhas na página principal
 * ----------------------------------------------------------------------------- */
let ordemAtual = "data"; // "data" ou "alfa", controlado pelos botões de ordenação

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
	const container = document.getElementById("container-folhas");
	if (!container) return;

	const folhas = ordenarFolhas(Cancioneiro.folhas.listar());

	if (folhas.length === 0) {
		container.innerHTML += "<p class='pesquisa-vazio'>Ainda não há folhas criadas.</p>";
		return;
	}

	const lista = document.createElement("ul");
	lista.className = "pesquisa-lista"; // Reaproveita o CSS das listas

	for (const folha of folhas) {
		const dataFormatada = folha.data
			? new Date(folha.data + "T00:00:00").toLocaleDateString("pt-PT", {
					day: "numeric", month: "short", year: "numeric"
				})
			: "Sem data";

		const li = document.createElement("li");
		li.className = "pesquisa-item";
		li.innerHTML = `
			<div class="pesquisa-info">
				<span class="pesquisa-titulo">${folha.titulo}</span>
				<span class="pesquisa-meta">${dataFormatada}</span>
			</div>
		`;

		// Clique na folha → abre a folha
		li.addEventListener("click", () => {
			window.location.href = `folha.html?id=${folha.id}`;
		});

		lista.appendChild(li);
	}
	
	container.appendChild(lista);
}

function renderizarFolhasMain() {
	// Botão de nova folha
	const btnNova = document.getElementById("btn-nova-folha");
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

/* ------------------------------------------------------------------------------
 * SECÇÃo 3: Inicialização
 * ----------------------------------------------------------------------------- */
async function init() {
	const todosCanticos = await carregarCanticos();
	
	ordemAtual = Cancioneiro.preferencias.obter("ordemFolhas") || "data";

	// Renderiza as folhas na página principal
	renderizarFolhasMain();

	const pesquisa = new Cancioneiro.Pesquisa(
		"container-pesquisa", 
		todosCanticos, 
		(cantico) => {
			window.location.href = `cantico.html?id=${cantico.id}`;
		}
	);

	// Escuta mudanças nas preferências
	document.addEventListener("preferencia-alterada", () => {
		pesquisa.renderizarLista();
	});
}

init();