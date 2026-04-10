// cantico.js — Lógica da página de visualização de um cântico

// -----------------------------------------------------------------------------
// SECÇÃO 1: Transposição de acordes
// -----------------------------------------------------------------------------

// Escala cromática em sustenidos e bemóis
const ESCALA_SUSTENIDOS = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const ESCALA_BEMOIS     = ["C","Db","D","Eb","E","F","Gb","G","Ab","A","Bb","B"];

/**
 * Transpõe um acorde um número de semitons.
 * Exemplos:
 *   transporAcorde("Am", 2)  → "Bm"
 *   transporAcorde("F#7", -1) → "F7"
 *
 * @param {string} acorde - Acorde em notação anglo-saxónica
 * @param {number} semitons - Número de semitons (positivo = sobe, negativo = desce)
 * @returns {string}
 */
function transporAcorde(acorde, semitons) {
	if (semitons === 0) return acorde;

	// Se estiver entre parênteses (ex: "(B F G)"), extrai o interior e transpõe
    if (acorde.startsWith("(") && acorde.endsWith(")")) {
        return "(" + transporAcorde(acorde.slice(1, -1), semitons) + ")";
    }

	// Se tiver múltiplos acordes separados por espaço (ex: "A D G")
    if (acorde.includes(" ")) {
        return acorde.split(" ").map(parte => transporAcorde(parte, semitons)).join(" ");
    }

	// Se for acorde composto com várias barras (ex: "A/C#/G")
    if (acorde.includes("/")) {
        return acorde.split("/").map(parte => transporAcorde(parte, semitons)).join("/");
    }
	
	// Encontra a nota base (pode ter # ou b)
	const match = acorde.match(/^([A-G][#b]?)(.*)/);
	if (!match) return acorde;

	const notaBase = match[1];
	const sufixo   = match[2];

	// Determina qual escala usar (preferir bemóis se a nota base já usa bemol)
	const escala = notaBase.includes("b") ? ESCALA_BEMOIS : ESCALA_SUSTENIDOS;

	const indiceAtual = escala.indexOf(notaBase);
	if (indiceAtual === -1) return acorde;

	// Calcula o novo índice (o % 12 garante que fica dentro da escala)
	const novoIndice = ((indiceAtual + semitons) % 12 + 12) % 12;
	return escala[novoIndice] + sufixo;
}


// -----------------------------------------------------------------------------
// SECÇÃO 2: Renderização da letra
// -----------------------------------------------------------------------------

/**
 * Renderiza uma linha de tokens ChordPro como HTML.
 * Cada token com acorde gera um <span> com o acorde por cima e a sílaba por baixo.
 *
 * @param {Array} tokens - Array de tokens {chord, text} do parser
 * @param {boolean} mostrarAcordes
 * @param {string} notacao - "anglo" ou "latino"
 * @param {number} semitons - transposição a aplicar
 * @returns {string} HTML da linha
 */
function renderizarLinha(tokens, mostrarAcordes, notacao, semitons) {
	// Linha de comentário
	if (tokens.length === 1 && tokens[0].isComment) {
		return `<div class="linha-comentario">${tokens[0].text}</div>`;
	}

	let html = '<div class="linha-letra">';

	for (const token of tokens) {
		if (token.chord && mostrarAcordes) {
			// Transpõe e converte notação
			let acorde = transporAcorde(token.chord, semitons);
			if (notacao === "latino") {
				acorde = Cancioneiro.parser.converterAcorde(acorde, "latino");
			}
			html += `<span class="token">
			<span class="acorde">${acorde}</span>
			<span class="silaba">${token.text || "\u00A0"}</span>
			</span>`;
		} else {
			// Sem acorde — texto simples (mas com espaço reservado se acordes visíveis)
			html += `<span class="token">
			${mostrarAcordes ? '<span class="acorde acorde-vazio">\u00A0</span>' : ''}
			<span class="silaba">${token.text}</span>
			</span>`;
		}
	}

	html += '</div>';
	return html;
}

/**
 * Renderiza o cântico completo no elemento #cantico-letra.
 *
 * @param {object} dadosCantico - Resultado do parseChordPro()
 * @param {string} canticoId
 */
function renderizarCantico(dadosCantico, canticoId, tomOriginal) {
	const mostrarAcordes = Cancioneiro.preferencias.obter("mostrarAcordes");
	const notacao        = Cancioneiro.preferencias.obter("notacao");
	const semitons       = Cancioneiro.preferencias.obterTransposicao(canticoId);

	// Renderiza transposição
	const tomApresentado = notacao === "latino"
		? Cancioneiro.parser.converterAcorde(transporAcorde(tomOriginal, semitons), "latino")
		: transporAcorde(tomOriginal, semitons);
	const transp = document.getElementById("cantico-transposicao");
	if (mostrarAcordes) {
		transp.classList.remove("oculto");
		document.getElementById("spn-transp-valor").textContent = `${tomApresentado}`;
	} else {
		transp.classList.add("oculto");
	}

	// Renderiza botão de Reset
	const btnReset = document.getElementById("btn-transp-reset");
	if (semitons !== 0) {
		btnReset.disabled = false;
	} else {
		btnReset.disabled = true;
	}

	// Renderiza cântico
	const container = document.getElementById("cantico-letra");
	container.innerHTML = "";

	for (const seccao of dadosCantico.sections) {
		const div = document.createElement("div");
		div.className = `seccao seccao-${seccao.type}`;

		// Etiqueta da secção (ex: "Estrofe 1", "Refrão")
		if (seccao.label) {
			div.innerHTML += `<div class="seccao-label">${seccao.label}</div>`;
		}

		for (const linha of seccao.lines) {
			if (linha === null) {
				// Linha vazia — separador de parágrafo
				div.innerHTML += '<div class="linha-vazia"></div>';
			} else {
				div.innerHTML += renderizarLinha(linha, mostrarAcordes, notacao, semitons);
			}
		}

		container.appendChild(div);
	}
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
										${c.titulo || c.title}
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

function preencheHeader(meta, tomOriginal) {
	const canticoMeta = document.getElementById("cantico-meta");
	const notacao     = Cancioneiro.preferencias.obter("notacao");

	// Preenche o cabeçalho
	const tituloEl = document.getElementById("cantico-titulo");
	tituloEl.textContent    = meta.title || meta.titulo;

	const autorEl = document.getElementById("cantico-autor");
	autorEl.textContent = meta.author || meta.autor;
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
	const respostaCho = await fetch(meta.ficheiro);
	const textoCho    = await respostaCho.text();

	// Faz parse
	const dadosCantico = Cancioneiro.parser.parseChordPro(textoCho);
	const tomOriginal  = dadosCantico.meta.key || meta.tom;
	const tomEl        = document.getElementById("cantico-tom");

	preencheHeader(meta, tomOriginal);
	registaEventos(canticoId, indice);

	// Renderiza a letra pela primeira vez
	renderizarCantico(dadosCantico, canticoId, tomOriginal);

	// Re-renderiza quando a preferência de mostrarAcordes ou a notação é alterada
	document.addEventListener("preferencia-alterada", () => {
		renderizarCantico(dadosCantico, canticoId, tomOriginal);
		tomEl.textContent = `Tom: ${converterAcorde(tomOriginal, Cancioneiro.preferencias.obter("notacao"))}`;
	});

	// Re-renderiza quando a transposição é alterada
	document.addEventListener("transposicao-alterada", () => {
		renderizarCantico(dadosCantico, canticoId, tomOriginal);
	});
}

init();