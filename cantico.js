// cantico.js — Lógica da página de visualização de um cântico

// -----------------------------------------------------------------------------
// SECÇÃO 2: Renderização da letra
// -----------------------------------------------------------------------------

/**
 * Renderiza o cântico completo no elemento #cantico-letra.
 *
 * @param {object} dadosCantico - Resultado do parseChordPro()
 * @param {string} canticoId
 */
function atualizaCantico(dadosCantico, canticoId, tomOriginal) {
	const mostrarAcordes = Cancioneiro.preferencias.obter("mostrarAcordes");
	const notacao        = Cancioneiro.preferencias.obter("notacao");
	const semitons       = Cancioneiro.preferencias.obterTransposicao(canticoId);

	// Renderiza transposição
	const tomApresentado = notacao === "latino"
		? Cancioneiro.parser.converterAcorde(transporAcorde(tomOriginal, semitons), "latino")
		: transporAcorde(tomOriginal, semitons);
	const transp = document.getElementById("transp-comp");
	if (mostrarAcordes) {
		transp.classList.remove("oculto");
		document.getElementById("spn-transp-valor").textContent = `${tomApresentado}`;
	} else {
		transp.classList.add("oculto");
	}

	// Renderiza botão de Reset
	const btnReset = document.getElementById("btn-transp-reset");
	btnReset.disabled = semitons === 0;

	// Renderiza cântico
	const container = document.getElementById("cantico-letra");
	container.innerHTML = renderizarCantico(dadosCantico, semitons);
	
	// Executa depois de renderizar
	requestAnimationFrame(() => ajustarTamanhoLetra(container));

	// Atualiza se a janela for redimensionada
	window.addEventListener('resize', () => ajustarTamanhoLetra(container));
}

// -----------------------------------------------------------------------------
// SECÇÃO 3: funções de inicialização e eventos
// -----------------------------------------------------------------------------

function registaEventos(canticoId, indice) {
	// Navegação
	const currentIndex = indice.findIndex(c => c.id === canticoId);
	const btnAnterior  = document.getElementById("btn-anterior");
	const btnSeguinte  = document.getElementById("btn-seguinte");
	const btnIndice    = document.getElementById("btn-indice");

	// Botão Anterior
	if (currentIndex <= 0) {
		btnAnterior.disabled = true;
	} else {
		btnAnterior.addEventListener("click", () => {
		const prevId = indice[currentIndex - 1].id;
		window.location.href = `cantico.html?id=${prevId}`;
		});
	}

	// Botão Seguinte
	if (currentIndex === -1 || currentIndex >= indice.length - 1) {
		btnSeguinte.disabled = true;
	} else {
		btnSeguinte.addEventListener("click", () => {
			const nextId = indice[currentIndex + 1].id;
			window.location.href = `cantico.html?id=${nextId}`;
		});
	}

	// Botão Índice
	btnIndice.addEventListener("click", () => {
		let painelIndice = document.getElementById("painel-indice");
		let overlayIndice = document.getElementById("overlay-indice");
		
		// Criar o painel caso ele ainda não exista na página
		if (!painelIndice) {
			overlayIndice = document.createElement("div");
			overlayIndice.id = "overlay-indice";
			overlayIndice.className = "overlay";
			overlayIndice.style = `
				display: none; 
				position: fixed; 
				inset: 0; 
				background: rgba(0,0,0,0.5); /* Se preferires invisível, mete transparent */
				z-index: 150;
			`;
			document.body.appendChild(overlayIndice);

			painelIndice = document.createElement("div");
			painelIndice.id = "painel-indice";
			painelIndice.className = "painel-fechado";

			// Criar o conteúdo e listar os cânticos 
			painelIndice.innerHTML = `
				<div id="painel-indice-interior" style="display: flex; flex-direction: column; height: 100%; padding: 1.5rem;">
					
					<!-- CABEÇALHO (sempre fixo no topo) -->
					<div id="painel-indice-cabecalho" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-shrink: 0;">
						<h2 style="margin: 0;">Índice</h2>
						<button id="btn-fechar-indice" style="background: none; border: none; font-size: 1.2rem; cursor: pointer; color: var(--cor-contorno);">✕</button>
					</div>

					<div id="painel-indice-pesquisa" style="flex-grow: 1; display: flex; flex-direction: column; overflow: hidden;"></div>
				</div>
			`;

			document.body.appendChild(painelIndice);
			
			// Inicializar pesquisa
			const pesquisaIndice = new Cancioneiro.Pesquisa(
				"painel-indice-pesquisa", 
				indice, 
				(cantico) => {
					window.location.href = `cantico.html?id=${cantico.id}`;
				}
			);

			// Fechar painel
			function fecharPainel() {
				painelIndice.classList.remove("painel-aberto");
				painelIndice.classList.add("painel-fechado");
				overlayIndice.style.display = "none";
			}

			document.getElementById("btn-fechar-indice").addEventListener("click", fecharPainel);

			overlayIndice.addEventListener("click", (e) => {
				if (e.target === overlayIndice) fecharPainel();
			});
		}

			// Ao clicar no botão índice, abrimos o painel
		overlayIndice.style.display = "block";
		painelIndice.classList.remove("painel-fechado");
		painelIndice.classList.add("painel-aberto");

		const itemAtual = document.getElementById("pesquisa-item-" + canticoId);
		if (itemAtual) {
			itemAtual.classList.add("cantico-atual");
			itemAtual.scrollIntoView({ behavior: 'instant', block: 'center' });
		}
	});


	// Transposição
	document.getElementById("btn-transp-mais").addEventListener("click", () => {
		Cancioneiro.preferencias.alterarTransposicao(canticoId, + 1);
	});
	document.getElementById("btn-transp-menos").addEventListener("click", () => {
		Cancioneiro.preferencias.alterarTransposicao(canticoId, - 1);
	});
	document.getElementById("btn-transp-reset").addEventListener("click", () => {
		Cancioneiro.preferencias.resetarTransposicao(canticoId);
	});

	// Editar cântico
	const btnEditar = document.getElementById("btn-editar-cantico");
	if (btnEditar) {
		btnEditar.addEventListener("click", async () => {
            const auth = await window.Cancioneiro.dbApi.authAdmin();
			if (auth.sucesso) {
				window.location.href = `editor-cantico.html?id=${canticoId}`;
			} else {
                alert("Autenticação necessária para editar cânticos.");
			}
		});
	}
}

function preencheHeader(dadosCantico, meta, tomOriginal) {
	const canticoMeta = document.getElementById("cantico-meta");
	const notacao     = Cancioneiro.preferencias.obter("notacao");

	// Preenche o cabeçalho
	const tituloEl = document.getElementById("cantico-titulo");
	tituloEl.textContent    = dadosCantico.meta.title || meta.titulo;
	document.title = dadosCantico.meta.title || meta.titulo;

	const subtituloEl = document.getElementById("cantico-subtitulo");
	if (dadosCantico.meta.subtitle || meta.subtitulo) {
		subtituloEl.textContent = `${"(" + (dadosCantico.meta.subtitle || meta.subtitulo) + ")"}`;
	}
	
	const autorEl = document.getElementById("cantico-autor");
	autorEl.textContent = dadosCantico.meta.author || meta.autor;
	canticoMeta.appendChild(autorEl);
	
	const tomEl = document.getElementById("cantico-tom");
	tomEl.textContent = `Tom: ${converterAcorde(tomOriginal, notacao)}`;
	if (autorEl.textContent !== "" && tomEl.textContent !== "") {
		canticoMeta.appendChild(document.createTextNode(" · "));
	}
	canticoMeta.appendChild(tomEl);
	
	const categoriasEl = document.getElementById("cantico-categorias");
	categoriasEl.textContent = meta.categorias ? meta.categorias.join(" · ") : "";
	if ((autorEl.textContent !== "" || tomEl.textContent !== "") && categoriasEl.textContent !== "") {
		canticoMeta.appendChild(document.createTextNode(" · "));
	}
	canticoMeta.appendChild(categoriasEl);
}

// -----------------------------------------------------------------------------
// SECÇÃO 4: Inicialização
// -----------------------------------------------------------------------------

async function init() {
	// Lê o id do cântico da URL (ex: cantico.html?id=001)
	const params    = new URLSearchParams(window.location.search);
	const canticoId = params.get("id");

	if (!canticoId) {
		document.getElementById("cantico-titulo").textContent = "Cântico não encontrado.";
		return;
	}

	// Carrega o índice do Firestore
	const indice = await window.Cancioneiro.dbApi.carregarIndice();
	const meta   = indice.find(c => c.id === canticoId);

	if (!meta) {
		document.getElementById("cantico-titulo").textContent = "Cântico não encontrado.";
		return;
	}

	// Carrega os detalhes do cântico do Firestore
	const docData = await window.Cancioneiro.dbApi.carregarCantico(canticoId);
	if (!docData) {
		document.getElementById("cantico-titulo").textContent = "Erro ao carregar ficheiro.";
		return;
	}

	// Faz parse
	const dadosCantico = Cancioneiro.parser.parseChordPro(docData.conteudoChordPro);
	const tomOriginal  = dadosCantico.meta.key || meta.tom;
	const tomEl        = document.getElementById("cantico-tom");

	preencheHeader(dadosCantico, meta, tomOriginal);
	registaEventos(canticoId, indice);

	// Renderiza a letra pela primeira vez
	atualizaCantico(dadosCantico, canticoId, tomOriginal);

	// Re-renderiza quando a preferência de mostrarAcordes ou a notação é alterada
	document.addEventListener("preferencia-alterada", () => {
		atualizaCantico(dadosCantico, canticoId, tomOriginal);
		tomEl.textContent = `Tom: ${converterAcorde(tomOriginal, Cancioneiro.preferencias.obter("notacao"))}`;
	});

	// Re-renderiza quando a transposição é alterada
	document.addEventListener("transposicao-alterada", () => {
		atualizaCantico(dadosCantico, canticoId, tomOriginal);
	});

	// Botão voltar
	const BASE_URL = window.location.pathname.includes('CancioneiroGJB')
		? '/CancioneiroGJB/'
		: '/';
	document.getElementById("btn-voltar").addEventListener("click", () => {
		window.location.href = BASE_URL;
	});

	// Google Analytics: envia evento de page_view depois de carregar dados
	if (window.gtag) {
		gtag('event', 'page_view', {
			page_path: `/cantico.html?id=${canticoId}`,
			page_title: document.title,
			cantico_id: canticoId,
			cantico_titulo: dadosCantico.meta.title || meta.titulo
		});
	}
}

init();