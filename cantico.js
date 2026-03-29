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
function renderizarCantico(dadosCantico, canticoId) {
	const mostrarAcordes = Cancioneiro.preferencias.obter("mostrarAcordes");
	const notacao        = Cancioneiro.preferencias.obter("notacao");
	const semitons       = Cancioneiro.preferencias.obterTransposicao(canticoId);

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


function atualizarMeta(dadosCantico, meta, canticoId) {
	const notacao     = Cancioneiro.preferencias.obter("notacao");
	const semitons    = Cancioneiro.preferencias.obterTransposicao(canticoId);
	const tomOriginal = dadosCantico.meta.key || meta.tom;

	const tomApresentado = notacao === "latino"
		? Cancioneiro.parser.converterAcorde(transporAcorde(tomOriginal, semitons), "latino")
		: transporAcorde(tomOriginal, semitons);

	const tomOriginalApresentado = notacao === "latino"
		? Cancioneiro.parser.converterAcorde(tomOriginal, "latino")
		: tomOriginal;

	const textoTom = semitons === 0
		? `Tom: ${tomApresentado}`
		: `Tom: ${tomApresentado} (original: ${tomOriginalApresentado})`;

	document.getElementById("cantico-meta").textContent =
		`${dadosCantico.meta.author || meta.autor} · ${textoTom}`;
}


// -----------------------------------------------------------------------------
// SECÇÃO 3: Controlos do painel (acordes + transposição)
// -----------------------------------------------------------------------------

function preencherPainelCantico(canticoId) {
	// Oculta definições gerais, mostra secção de cântico
	const secaoCantico = document.getElementById("painel-secao-cantico");
	if (secaoCantico) secaoCantico.classList.remove("oculto");

	const semitons    = Cancioneiro.preferencias.obterTransposicao(canticoId);
	const mostrar     = Cancioneiro.preferencias.obter("mostrarAcordes");
	const notacao     = Cancioneiro.preferencias.obter("notacao");
	const tomOriginal = document.getElementById("cantico-titulo").dataset.tom || "";
	const tomAtual    = transporAcorde(tomOriginal, semitons);

	const painel = document.getElementById("painel-cantico-atual");

	painel.innerHTML = `
		<div class="definicao-grupo">
			<label>Acordes</label>
			<div class="opcoes-toggle">
				<button class="opcao-toggle ${mostrar ? "ativo" : ""}"
					id="btn-mostrar-acordes">Mostrar</button>
				<button class="opcao-toggle ${!mostrar ? "ativo" : ""}"
					id="btn-ocultar-acordes">Ocultar</button>
			</div>
		</div>

		${mostrar ? `
			<div class="definicao-grupo">
				<label>Notação</label>
				<div class="opcoes-toggle">
					<button class="opcao-toggle ${notacao === "anglo" ? "ativo" : ""}"
						data-pref="notacao" data-valor="anglo">CDEFGAB</button>
					<button class="opcao-toggle ${notacao === "latino" ? "ativo" : ""}"
						data-pref="notacao" data-valor="latino">DóRéMi</button>
				</div>
			</div>

			<div class="definicao-grupo">
				<label>Transposição</label>
				<div class="transposicao-controlo">
					<button id="btn-transp-menos">−</button>
					<span id="transp-valor">${tomAtual}</span>
					<button id="btn-transp-mais">+</button>
					<button id="btn-transp-reset">Repor</button>
				</div>
			</div>
		` : ""}
	`;

	// Eventos dos botões de acordes
	document.getElementById("btn-mostrar-acordes").addEventListener("click", () => {
		Cancioneiro.preferencias.definir("mostrarAcordes", true);
	});
	document.getElementById("btn-ocultar-acordes").addEventListener("click", () => {
		Cancioneiro.preferencias.definir("mostrarAcordes", false);
	});

	if (mostrar) {
		document.getElementById("btn-transp-mais").addEventListener("click", () => {
			Cancioneiro.preferencias.definirTransposicao(canticoId,
			Cancioneiro.preferencias.obterTransposicao(canticoId) + 1);
		});
		document.getElementById("btn-transp-menos").addEventListener("click", () => {
			Cancioneiro.preferencias.definirTransposicao(canticoId,
			Cancioneiro.preferencias.obterTransposicao(canticoId) - 1);
		});
		document.getElementById("btn-transp-reset").addEventListener("click", () => {
			Cancioneiro.preferencias.resetarTransposicao(canticoId);
		});

		painel.querySelectorAll('button[data-pref="notacao"]').forEach(btn => {
			btn.addEventListener("click", () => {
				Cancioneiro.preferencias.definir("notacao", btn.dataset.valor);
			});
		});
	}
}

function atualizarIndicadorTransposicao(canticoId) {
	preencherPainelCantico(canticoId);
}


// -----------------------------------------------------------------------------
// SECÇÃO 4: Inicialização
// -----------------------------------------------------------------------------

async function init() {
	document.body.classList.add("pagina-cantico");

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

	// Preenche o cabeçalho
	const tituloEl = document.getElementById("cantico-titulo");
	tituloEl.textContent    = dadosCantico.meta.title || meta.titulo;
	tituloEl.dataset.tom    = dadosCantico.meta.key   || meta.tom;

	// Renderiza a letra (não depende do painel, pode acontecer já)
	renderizarCantico(dadosCantico, canticoId);
	atualizarMeta(dadosCantico, meta, canticoId);

	// Resolve timing: preenche o painel quando estiver pronto
	function quandoPainelPronto(callback) {
		if (window.Cancioneiro.painelPronto) {
			callback();
		} else {
			document.addEventListener("painel-pronto", callback, { once: true });
		}
	}

	quandoPainelPronto(() => preencherPainelCantico(canticoId));

	document.addEventListener("preferencia-alterada", () => {
		renderizarCantico(dadosCantico, canticoId);
		preencherPainelCantico(canticoId);
		atualizarMeta(dadosCantico, meta, canticoId);
	});

	document.addEventListener("transposicao-alterada", () => {
		renderizarCantico(dadosCantico, canticoId);
		preencherPainelCantico(canticoId);
		atualizarMeta(dadosCantico, meta, canticoId);
	});
}

init();