// app.js — Lógica da página principal (lista de cânticos)

/* -----------------------------------------------------------------------------
 * Carrega o índice de cânticos
 * ----------------------------------------------------------------------------- */

async function carregarCanticos() {
	return await window.Cancioneiro.dbApi.carregarIndice();
}

/* ------------------------------------------------------------------------------
 * SECÇÃO 2: Secção de folhas na página principal
 * ----------------------------------------------------------------------------- */
let ordemAtual = "data"; // "data" ou "alfa", controlado pelos botões de ordenação
let folhasEmMemoria = null; // Guarda os dados para não repetir pedidos à base de dados

function ordenarFolhas(folhas) {
	if (ordemAtual === "data") {
		return [...folhas].sort((a, b) => {
			if (!a.data && !b.data) return 0;
			if (!a.data) return 1;
			if (!b.data) return -1;
			return b.data.localeCompare(a.data); // mais recente primeiro
		});
	}
	
	 // Por defeito / Alfa: Ordem alfabética
	return [...folhas].sort((a, b) => {
		return (a.titulo || "").localeCompare((b.titulo || ""), "pt");
	});
}

async function carregarFolhas() {
	const container = document.getElementById("container-folhas");
	if (!container) return;

	container.innerHTML = "<p class='pesquisa-vazio'>A carregar folhas...</p>";

	try {
        const folhasLocal = window.Cancioneiro.folhas.listar();

		// Obter folhas privadas (locais)
		const privadas = folhasLocal.privada;

		// Obter folhas partilhadas (base de dados com referência local)
		let partilhadas = [];
		if (window.Cancioneiro.dbApi && window.Cancioneiro.dbApi.listarFolhaPartilhada) {
			partilhadas = await window.Cancioneiro.dbApi.listarFolhaPartilhada(folhasLocal.partilhada);
		}

		// Obter folhas públicas (base de dados)
		let publicas = [];
		if (window.Cancioneiro.dbApi && window.Cancioneiro.dbApi.listarFolhas) {
			publicas = await window.Cancioneiro.dbApi.listarFolhas("publica");
		}

		// Guardar na memória
		folhasEmMemoria = [...partilhadas, ...publicas, ...privadas];

		atualizarLista();
	} catch (error) {
		console.error("Erro ao carregar folhas:", error);
		const container = document.getElementById("container-folhas");
		if (container) {
			container.innerHTML = "<p class='pesquisa-vazio'>Erro ao carregar folhas. Verifique as permissões da base de dados.</p>";
		}
	}
}

function atualizarLista() {
	const container = document.getElementById("container-folhas");
	if (!container || !folhasEmMemoria) return;

	const folhas = ordenarFolhas(folhasEmMemoria);

	container.innerHTML = ""; // Limpa a mensagem de carregamento ou lista anterior

	if (folhas.length === 0) {
		container.innerHTML = "<p class='pesquisa-vazio'>Ainda não há folhas criadas.</p>";
		return;
	}

	const lista = document.createElement("ul");
	lista.className = "pesquisa-lista"; 

	for (const folha of folhas) {
		const dataFormatada = folha.data
			? new Date(folha.data + "T00:00:00").toLocaleDateString("pt-PT", {
					day: "numeric", month: "short", year: "numeric"
				})
			: "Sem data";

		const iconeFolha = folha.tipo === "publica" ? " 🌐"
			: folha.tipo === "partilhada" ? " 🔗"
			: folha.tipo === "privada" ? " 📝"
			: "";

		const li = document.createElement("li");
		li.className = "pesquisa-item";
		li.innerHTML = `
			<div class="pesquisa-info">
				<span class="pesquisa-titulo">${folha.titulo}${iconeFolha}</span>
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
            novaFolha.tipo = "privada"; // Garantir que é privada
			window.location.href = `editor-folha.html?id=${novaFolha.id}`;
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
			atualizarLista(); // Apenas reordena e desenha
		});

		btnAlfa.addEventListener("click", () => {
			ordemAtual = "alfa";
			btnAlfa.classList.add("ativo");
			btnData.classList.remove("ativo");
			atualizarLista(); // Apenas reordena e desenha
		});
		
		// Atualiza o estado inicial dos botões consoante a ordem atual
		if (ordemAtual === "data") {
			btnData.classList.add("ativo");
		} else {
			btnAlfa.classList.add("ativo");
		}
	}

	// Executa a chamada à base de dados na primeira vez
	carregarFolhas();
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

	// Google Analytics: envia evento de page_view
	if (window.gtag) {
		gtag('event', 'page_view', {
			page_path: window.location.pathname,
			page_title: document.title,
			page_type: 'home'
		});
	}
}

init();