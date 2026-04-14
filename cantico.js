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

					 <!-- CORPO COM SCROLL (ocupa o resto do espaço) -->
					<div id="painel-indice-corpo" style="flex-grow: 1; overflow-y: auto; overflow-x: hidden;">
						<ul id="lista-indice" style="list-style: none; padding: 0; margin: 0;">
							${indice.map(c => `
								<li ${c.id === canticoId ? 'id="indice-item-atual"' : ''} style="margin-bottom: 0.5rem; ${c.id === canticoId ? 'font-weight: bold; background-color: var(--cor-fundo-secundario, #f0f0f0); padding: 5px; border-radius: 4px;' : 'padding: 5px;'}">
									<a href="cantico.html?id=${c.id}" style="text-decoration: none; color: inherit; display: block;">
										${(c.titulo || c.title) + (c.subtitulo ? ' (' + (c.subtitulo || c.subtitle) + ')' : '')}
									</a>
								</li>
						`).join('')}
					</ul>
				</div>
			`;

			document.body.appendChild(painelIndice);
			
			// Fechar painel
			function fecharPainel() {
				painelIndice.classList.remove("painel-aberto");
				painelIndice.classList.add("painel-fechado");
				overlayIndice.style.display = "none";
			}

			document.getElementById("btn-fechar-indice").addEventListener("click", fecharPainel);

			overlayIndice.addEventListener("click", (e) => {
                // Verifica de facto se se clicou exatamente neste "fundo", sem filhos envolvidos
                if (e.target === overlayIndice) {
                    fecharPainel();
                }
            });
		}

			// Ao clicar no botão índice, abrimos o painel
		overlayIndice.style.display = "block";
		painelIndice.classList.remove("painel-fechado");
		painelIndice.classList.add("painel-aberto");

		const itemAtual = document.getElementById("indice-item-atual");
		itemAtual.scrollIntoView({ behavior: 'instant', block: 'center' });
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
}

function preencheHeader(dadosCantico, meta, tomOriginal) {
	const canticoMeta = document.getElementById("cantico-meta");
	const notacao     = Cancioneiro.preferencias.obter("notacao");

	// Preenche o cabeçalho
	const tituloEl = document.getElementById("cantico-titulo");
	tituloEl.textContent    = dadosCantico.meta.title || meta.titulo;

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

	// Carrega o índice para obter o caminho do ficheiro .cho
	const respostaIndice = await fetch("dados/index.json");
	const indice         = await respostaIndice.json();
	const meta           = indice.find(c => c.id === canticoId);

	if (!meta) {
		document.getElementById("cantico-titulo").textContent = "Cântico não encontrado.";
		return;
	}

	// Carrega o ficheiro .cho
	const respostaCho = await fetch(meta.ficheiro + "?v=" + Date.now());
	const textoCho    = await respostaCho.text();

	// Faz parse
	const dadosCantico = Cancioneiro.parser.parseChordPro(textoCho);
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
}

init();