// folha.js — Lógica da página de uma folha de cânticos

// -----------------------------------------------------------------------------
// SECÇÃO 1: Estado da página
// -----------------------------------------------------------------------------

let estadoFolha = {
	folha: null,
	indice: [],
	canticosCache: {},
	modo: "editar",
	momentoAtivo: 0,
	modoNav: "continuo"
};


// -----------------------------------------------------------------------------
// SECÇÃO 2: Carregamento de dados
// -----------------------------------------------------------------------------

async function carregarIndice() {
	const resposta = await fetch("dados/index.json");
	return await resposta.json();
}

async function carregarCantico(canticoId) {
	if (estadoFolha.canticosCache[canticoId]) {
		return estadoFolha.canticosCache[canticoId];
	}
	const meta = estadoFolha.indice.find(c => c.id === canticoId);
	if (!meta) return null;

	const resposta = await fetch(meta.ficheiro);
	const texto    = await resposta.text();
	const dados    = Cancioneiro.parser.parseChordPro(texto);
	estadoFolha.canticosCache[canticoId] = { meta, dados };
	return estadoFolha.canticosCache[canticoId];
}


// -----------------------------------------------------------------------------
// SECÇÃO 3: Renderização da letra
// -----------------------------------------------------------------------------

const ESCALA_SUSTENIDOS = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const ESCALA_BEMOIS     = ["C","Db","D","Eb","E","F","Gb","G","Ab","A","Bb","B"];

function transporAcorde(acorde, semitons) {
	if (semitons === 0) return acorde;
	const match = acorde.match(/^([A-G][#b]?)(.*)/);
	if (!match) return acorde;
	const notaBase = match[1];
	const sufixo   = match[2];
	const escala   = notaBase.includes("b") ? ESCALA_BEMOIS : ESCALA_SUSTENIDOS;
	const idx      = escala.indexOf(notaBase);
	if (idx === -1) return acorde;
	return escala[((idx + semitons) % 12 + 12) % 12] + sufixo;
}

function renderizarLinhaFolha(tokens, mostrarAcordes, notacao, semitons) {
	if (tokens.length === 1 && tokens[0].isComment) {
		return `<div class="linha-comentario">${tokens[0].text}</div>`;
	}
	let html = '<div class="linha-letra">';
	for (const token of tokens) {
		if (token.chord && mostrarAcordes) {
			let acorde = transporAcorde(token.chord, semitons);
			if (notacao === "latino") {
				acorde = Cancioneiro.parser.converterAcorde(acorde, "latino");
			}
			html += `<span class="token">
				<span class="acorde">${acorde}</span>
				<span class="silaba">${token.text || "\u00A0"}</span>
			</span>`;
		} else {
			html += `<span class="token">
				${mostrarAcordes ? '<span class="acorde acorde-vazio">\u00A0</span>' : ''}
				<span class="silaba">${token.text}</span>
			</span>`;
		}
	}
	html += '</div>';
	return html;
}

function renderizarLetraCantico(dados, opcoes) {
	const { seccoes, semitons, mostrarAcordes, notacao } = opcoes;
	let html = "";
	for (const seccao of dados.sections) {
		if (seccoes && !seccoes.includes(seccao.label)) continue;
		html += `<div class="seccao seccao-${seccao.type}">`;
		if (seccao.label) {
			html += `<div class="seccao-label">${seccao.label}</div>`;
		}
		for (const linha of seccao.lines) {
			if (linha === null) {
				html += '<div class="linha-vazia"></div>';
			} else {
				html += renderizarLinhaFolha(linha, mostrarAcordes, notacao, semitons || 0);
			}
		}
		html += '</div>';
	}
	return html;
}


// -----------------------------------------------------------------------------
// SECÇÃO 4: Renderização da folha
// -----------------------------------------------------------------------------

async function renderizarFolha() {
	const conteudo      = document.getElementById("folha-conteudo");
	const notacao       = Cancioneiro.preferencias.obter("notacao");
	const mostrarAcordes = Cancioneiro.preferencias.obter("mostrarAcordes");
	conteudo.innerHTML  = "";

	const { folha, modo, momentoAtivo } = estadoFolha;
	const momentosFiltrados = folha.momentos.filter(
		m => modo === "editar" || m.canticos.length > 0
	);

	for (let i = 0; i < momentosFiltrados.length; i++) {
		const momento = momentosFiltrados[i];
		const oculto = estadoFolha.modo === "apresentar" &&
						estadoFolha.modoNav === "individual" &&
						i !== estadoFolha.momentoAtivo ? "oculto" : "";
		const secDiv = document.createElement("div");
		secDiv.className = `folha-momento ${oculto}`;
		secDiv.dataset.index = i;

		// --- Cabeçalho do momento ---
		const cabMomento = document.createElement("div");
		cabMomento.className = "folha-momento-cabecalho";

		if (modo === "editar") {
			const idxReal = folha.momentos.indexOf(momento);
			cabMomento.innerHTML = `
				<h2 class="folha-momento-titulo">${momento.label}</h2>
				<div class="folha-momento-acoes">
					<button class="btn-renomear-momento" data-id="${momento.id}" title="Renomear">✎</button>
					<button class="btn-mover-momento-cima" data-idx="${idxReal}"
						title="Mover para cima" ${idxReal === 0 ? "disabled" : ""}>↑</button>
					<button class="btn-mover-momento-baixo" data-idx="${idxReal}"
						title="Mover para baixo"
						${idxReal === folha.momentos.length - 1 ? "disabled" : ""}>↓</button>
					<button class="btn-apagar-momento" data-id="${momento.id}" title="Apagar momento">✕</button>
				</div>
			`;
		} else {
			cabMomento.innerHTML = `<h2 class="folha-momento-titulo">${momento.label}</h2>`;
		}
		secDiv.appendChild(cabMomento);

		// --- Cânticos do momento ---
		for (const entrada of momento.canticos) {
			const canticoData = await carregarCantico(entrada.canticoId);
			if (!canticoData) continue;

			const { meta, dados } = canticoData;
			const semitons    = entrada.tom || 0;
			const tomOriginal = dados.meta.key || meta.tom;
			const tomAtual    = transporAcorde(tomOriginal, semitons);
			const notacao     = Cancioneiro.preferencias.obter("notacao");

			const tomApresentado = notacao === "latino"
				? Cancioneiro.parser.converterAcorde(tomAtual, "latino")
				: tomAtual;
			const tomOriginalApresentado = notacao === "latino"
				? Cancioneiro.parser.converterAcorde(tomOriginal, "latino")
				: tomOriginal;
			const tomTexto = semitons === 0
				? `Tom: ${tomApresentado}`
				: `Tom: ${tomApresentado} (original: ${tomOriginalApresentado})`;

			const letra = renderizarLetraCantico(dados, {
				seccoes: entrada.seccoes,
				semitons,
				mostrarAcordes,
				notacao
			});

			const canticoDiv = document.createElement("div");
			canticoDiv.className = "folha-cantico";
			canticoDiv.dataset.canticoId = entrada.canticoId;
			canticoDiv.dataset.momentoId = momento.id;

			canticoDiv.innerHTML = `
				<div class="folha-cantico-cabecalho">
					<div class="folha-cantico-info">
						<span class="folha-cantico-titulo">${dados.meta.title || meta.titulo}</span>
						<span class="folha-cantico-tom">${tomTexto}</span>
						${entrada.notas ? `<span class="folha-cantico-notas">${entrada.notas}</span>` : ""}
					</div>
					<div class="folha-cantico-acoes">
					${mostrarAcordes ? `
						<div class="transposicao-controlo transposicao-inline">
							<button class="btn-transp-menos-inline"
								data-momento="${momento.id}" data-cantico="${entrada.canticoId}">−</button>
							<span class="transp-valor-inline">${tomApresentado}</span>
							<button class="btn-transp-mais-inline"
								data-momento="${momento.id}" data-cantico="${entrada.canticoId}">+</button>
							<button class="btn-transp-reset-inline"
								data-momento="${momento.id}" data-cantico="${entrada.canticoId}">Repor</button>
						</div>
					` : ""}

					<a href="cantico.html?id=${entrada.canticoId}"
					class="btn-link-cantico" title="Abrir cântico" target="_blank">↗</a>
					
					${modo === "editar" ? `
						<button class="btn-editar-entrada" data-momento="${momento.id}"
							data-cantico="${entrada.canticoId}" title="Editar">✎</button>
						<button class="btn-remover-cantico" title="Remover">✕</button>
					` : ""}
					
					</div>
				</div>
				<div class="folha-cantico-letra">${letra}</div>
			`;

			secDiv.appendChild(canticoDiv);
		}

		// --- Botão adicionar cântico (modo editar) ---
		if (modo === "editar") {
			const btnAdicionar = document.createElement("button");
			btnAdicionar.className = "btn-adicionar-cantico";
			btnAdicionar.dataset.momento = momento.id;
			btnAdicionar.textContent = "+ Adicionar cântico";
			secDiv.appendChild(btnAdicionar);
		}

		conteudo.appendChild(secDiv);
	}

	// --- Botão adicionar momento (modo editar, no final) ---
	if (modo === "editar") {
		const btnAddMomento = document.createElement("button");
		btnAddMomento.id = "btn-adicionar-momento";
		btnAddMomento.textContent = "+ Adicionar momento";
		conteudo.appendChild(btnAddMomento);
	}

	ligarEventos(momentosFiltrados);
	atualizarNavegacao(momentosFiltrados);
}


// -----------------------------------------------------------------------------
// SECÇÃO 5: Eventos
// -----------------------------------------------------------------------------
function obterEntrada(momentoId, canticoId) {
	const momento = estadoFolha.folha.momentos.find(m => m.id === momentoId);
	return momento?.canticos.find(c => c.canticoId === canticoId) || null;
}

function ligarEventos(momentosFiltrados) {
	const folhaId = estadoFolha.folha.id;

	// Transposição inline
	document.querySelectorAll(".btn-transp-mais-inline").forEach(btn => {
		btn.addEventListener("click", () => {
		const entrada = obterEntrada(btn.dataset.momento, btn.dataset.cantico);
		if (!entrada) return;
			entrada.tom = (entrada.tom || 0) + 1;
			Cancioneiro.folhas.guardar(estadoFolha.folha);
			renderizarFolha();
		});
	});
	document.querySelectorAll(".btn-transp-menos-inline").forEach(btn => {
		btn.addEventListener("click", () => {
		const entrada = obterEntrada(btn.dataset.momento, btn.dataset.cantico);
		if (!entrada) return;
			entrada.tom = (entrada.tom || 0) - 1;
			Cancioneiro.folhas.guardar(estadoFolha.folha);
			renderizarFolha();
		});
	});
	document.querySelectorAll(".btn-transp-reset-inline").forEach(btn => {
		btn.addEventListener("click", () => {
		const entrada = obterEntrada(btn.dataset.momento, btn.dataset.cantico);
		if (!entrada) return;
			entrada.tom = 0;
			Cancioneiro.folhas.guardar(estadoFolha.folha);
			renderizarFolha();
		});
	});

	// Remover cântico
	document.querySelectorAll(".btn-remover-cantico").forEach(btn => {
		const canticoDiv = btn.closest(".folha-cantico");
		btn.addEventListener("click", () => {
			const canticoId = canticoDiv.dataset.canticoId;
			const momentoId = canticoDiv.dataset.momentoId;
			if (confirm("Remover este cântico da folha?")) {
				Cancioneiro.folhas.removerCantico(folhaId, momentoId, canticoId);
				estadoFolha.folha = Cancioneiro.folhas.obter(folhaId);
				renderizarFolha();
			}
		});
	});

	// Editar entrada (tom + secções + notas)
	document.querySelectorAll(".btn-editar-entrada").forEach(btn => {
		btn.addEventListener("click", () => {
			abrirModalEditarEntrada(btn.dataset.momento, btn.dataset.cantico);
		});
	});

	// Adicionar cântico
	document.querySelectorAll(".btn-adicionar-cantico").forEach(btn => {
		btn.addEventListener("click", () => {
			abrirOverlayAdicionar(btn.dataset.momento);
		});
	});

	// Renomear momento
	document.querySelectorAll(".btn-renomear-momento").forEach(btn => {
		btn.addEventListener("click", () => {
			const momento = estadoFolha.folha.momentos.find(m => m.id === btn.dataset.id);
			if (!momento) return;
			const novoLabel = prompt("Novo nome do momento:", momento.label);
			if (novoLabel && novoLabel.trim()) {
				momento.label = novoLabel.trim();
				Cancioneiro.folhas.guardar(estadoFolha.folha);
				renderizarFolha();
			}
		});
	});

	// Mover momento para cima
	document.querySelectorAll(".btn-mover-momento-cima").forEach(btn => {
		btn.addEventListener("click", () => {
			const idx = parseInt(btn.dataset.idx);
			if (idx <= 0) return;
			const momentos = estadoFolha.folha.momentos;
			[momentos[idx - 1], momentos[idx]] = [momentos[idx], momentos[idx - 1]];
			Cancioneiro.folhas.guardar(estadoFolha.folha);
			renderizarFolha();
		});
	});

	// Mover momento para baixo
	document.querySelectorAll(".btn-mover-momento-baixo").forEach(btn => {
		btn.addEventListener("click", () => {
			const idx = parseInt(btn.dataset.idx);
			const momentos = estadoFolha.folha.momentos;
			if (idx >= momentos.length - 1) return;
			[momentos[idx], momentos[idx + 1]] = [momentos[idx + 1], momentos[idx]];
			Cancioneiro.folhas.guardar(estadoFolha.folha);
			renderizarFolha();
		});
	});

	// Apagar momento
	document.querySelectorAll(".btn-apagar-momento").forEach(btn => {
		btn.addEventListener("click", () => {
			const momento = estadoFolha.folha.momentos.find(m => m.id === btn.dataset.id);
			if (!momento) return;
			if (confirm(`Apagar o momento "${momento.label}"?`)) {
				estadoFolha.folha.momentos = estadoFolha.folha.momentos.filter(
					m => m.id !== btn.dataset.id
				);
				Cancioneiro.folhas.guardar(estadoFolha.folha);
				renderizarFolha();
			}
		});
	});

	// Adicionar momento
	const btnAddMomento = document.getElementById("btn-adicionar-momento");
	if (btnAddMomento) {
		btnAddMomento.addEventListener("click", () => {
			const label = prompt("Nome do novo momento:");
			if (label && label.trim()) {
				const novoId = label.trim().toLowerCase()
					.replace(/\s+/g, "-")
					.replace(/[^a-z0-9-]/g, "");
				estadoFolha.folha.momentos.push({
					id: novoId + "-" + Date.now().toString(36),
					label: label.trim(),
					canticos: []
				});
				Cancioneiro.folhas.guardar(estadoFolha.folha);
				renderizarFolha();
			}
		});
	}

	// Navegação entre momentos (modo apresentar individual)
	const btnAnterior = document.getElementById("btn-momento-anterior");
	const btnSeguinte = document.getElementById("btn-momento-seguinte");
	const btnLabel    = document.getElementById("folha-nav-label");
	const dropdown    = document.getElementById("folha-nav-dropdown");

	if (btnAnterior) {
		btnAnterior.onclick = () => {
		if (estadoFolha.momentoAtivo > 0) {
			estadoFolha.momentoAtivo--;
			renderizarFolha();
		}
		};
	}
	if (btnSeguinte) {
		btnSeguinte.onclick = () => {
			if (estadoFolha.momentoAtivo < momentosFiltrados.length - 1) {
				estadoFolha.momentoAtivo++;
				renderizarFolha();
			}
		};
	}
	if (btnLabel) {
		btnLabel.onclick = (e) => {
			e.stopPropagation();
			dropdown.classList.toggle("oculto");
		};
		document.addEventListener("click", () => {
			dropdown.classList.add("oculto");
		}, { once: true });
	}
}

function atualizarNavegacao(momentosFiltrados) {
	const nav      = document.getElementById("folha-nav-momentos");
	const label    = document.getElementById("folha-nav-label");
	const dropdown = document.getElementById("folha-nav-dropdown");
	if (!nav || !label) return;

	const mostrarNav = estadoFolha.modo === "apresentar" &&
	estadoFolha.modoNav === "individual" &&
	momentosFiltrados.length > 0;

	if (mostrarNav) {
		nav.classList.remove("oculto");
		label.textContent = momentosFiltrados[estadoFolha.momentoAtivo]?.label || "";

		dropdown.innerHTML = "";
		momentosFiltrados.forEach((m, i) => {
			const li = document.createElement("li");
			li.textContent = m.label;
			li.classList.toggle("ativo", i === estadoFolha.momentoAtivo);
			li.addEventListener("click", () => {
				estadoFolha.momentoAtivo = i;
				dropdown.classList.add("oculto");
				renderizarFolha();
			});
			dropdown.appendChild(li);
		});
	} else {
		nav.classList.add("oculto");
	}
}


// -----------------------------------------------------------------------------
// SECÇÃO 6: Modal de edição de entrada (tom + secções + notas)
// -----------------------------------------------------------------------------

async function abrirModalEditarEntrada(momentoId, canticoId) {
	const folha   = estadoFolha.folha;
	const momento = folha.momentos.find(m => m.id === momentoId);
	const entrada = momento?.canticos.find(c => c.canticoId === canticoId);
	if (!entrada) return;

	const canticoData = await carregarCantico(canticoId);
	if (!canticoData) return;

	const { meta, dados } = canticoData;
	const tomOriginal = dados.meta.key || meta.tom;
	const semitons    = entrada.tom || 0;
	const tomAtual    = transporAcorde(tomOriginal, semitons);

	// Remove modal anterior se existir
	document.getElementById("modal-editar-entrada")?.remove();

	const modal = document.createElement("div");
	modal.id = "modal-editar-entrada";
	modal.innerHTML = `
		<div id="modal-interior">
			<div id="modal-cabecalho">
				<h3>${dados.meta.title || meta.titulo}</h3>
				<button id="btn-fechar-modal">✕</button>
			</div>

			<div class="form-grupo">
				<label>Secções a incluir</label>
				<div id="modal-seccoes">
					${dados.sections.map(s => `
						<label class="modal-seccao-item">
							<input type="checkbox" value="${s.label}"
								${!entrada.seccoes || entrada.seccoes.includes(s.label) ? "checked" : ""}>
							${s.label || "(sem etiqueta)"}
						</label>
					`).join("")}
				</div>
			</div>

			<div class="form-grupo">
				<label>Notas</label>
				<input type="text" id="modal-notas" value="${entrada.notas || ""}"
					placeholder="Ex: Repetir refrão no final">
			</div>

			<div class="form-acoes">
				<button id="btn-guardar-entrada">Guardar</button>
				<button id="btn-cancelar-modal">Cancelar</button>
			</div>
		</div>
	`;

	document.body.appendChild(modal);

	// Fechar
	document.getElementById("btn-fechar-modal").addEventListener("click", () => modal.remove());
	document.getElementById("btn-cancelar-modal").addEventListener("click", () => modal.remove());

	// Guardar
	document.getElementById("btn-guardar-entrada").addEventListener("click", () => {
		const checkboxes = modal.querySelectorAll("#modal-seccoes input[type=checkbox]");
		const todasChecked = [...checkboxes].every(cb => cb.checked);
		const selecionadas = [...checkboxes]
			.filter(cb => cb.checked)
			.map(cb => cb.value);

		entrada.seccoes = todasChecked ? null : selecionadas;
		entrada.notas  = document.getElementById("modal-notas").value.trim();

		Cancioneiro.folhas.guardar(folha);
		modal.remove();
		renderizarFolha();
	});
}


// -----------------------------------------------------------------------------
// SECÇÃO 7: Overlay de adicionar cântico
// -----------------------------------------------------------------------------

function abrirOverlayAdicionar(momentoId) {
	document.getElementById("overlay-adicionar-cantico")?.remove();

	const overlay = document.createElement("div");
	overlay.id = "overlay-adicionar-cantico";

	overlay.innerHTML = `
		<div id="overlay-interior">
			<div id="overlay-cabecalho">
				<h3>Adicionar cântico</h3>
				<button id="btn-fechar-overlay">✕</button>
			</div>
			<input type="text" id="overlay-pesquisa"
			placeholder="Pesquisar por título, autor ou categoria...">
			<div id="overlay-filtros">
				<button class="filtro-categoria ativo" data-categoria="">Todos</button>
			</div>
			<ul id="overlay-lista"></ul>
		</div>
	`;

	document.body.appendChild(overlay);

	const inputPesquisa = document.getElementById("overlay-pesquisa");
	const listaEl       = document.getElementById("overlay-lista");
	const filtrosEl     = document.getElementById("overlay-filtros");

	const momento       = estadoFolha.folha.momentos.find(m => m.id === momentoId);
	const jaAdicionados = new Set(momento?.canticos.map(c => c.canticoId) || []);

	// Gera botões de categorias
	const todasCategorias = new Set();
	estadoFolha.indice.forEach(c => c.categorias?.forEach(cat => todasCategorias.add(cat)));
	todasCategorias.forEach(cat => {
		const btn = document.createElement("button");
		btn.className = "filtro-categoria";
		btn.dataset.categoria = cat;
		btn.textContent = cat;
		filtrosEl.appendChild(btn);
	});

	let categoriaAtiva = "";

	function renderizarListaOverlay() {
		const termo    = inputPesquisa.value.toLowerCase();
		listaEl.innerHTML = "";

		const filtrados = estadoFolha.indice.filter(c => {
			const matchTexto = !termo ||
				c.titulo.toLowerCase().includes(termo) ||
				(c.autor || "").toLowerCase().includes(termo) ||
				(c.categorias || []).some(cat => cat.toLowerCase().includes(termo));
				const matchCategoria = !categoriaAtiva ||
				(c.categorias || []).includes(categoriaAtiva);
			return matchTexto && matchCategoria;
		});

		if (filtrados.length === 0) {
			listaEl.innerHTML = "<li class='overlay-vazio'>Nenhum cântico encontrado.</li>";
			return;
		}

		const notacao = Cancioneiro.preferencias.obter("notacao");

		for (const cantico of filtrados) {
			const jaEsta = jaAdicionados.has(cantico.id);
			const tomApresentado = notacao === "latino"
				? Cancioneiro.parser.converterAcorde(cantico.tom, "latino")
				: cantico.tom;

			const li = document.createElement("li");
			li.className = `overlay-cantico-item ${jaEsta ? "ja-adicionado" : ""}`;
			li.innerHTML = `
				<div class="overlay-cantico-info">
					<span class="overlay-cantico-titulo">${cantico.titulo}</span>
					<span class="overlay-cantico-meta">${cantico.autor} · Tom: ${tomApresentado}</span>
				</div>
				${jaEsta ? '<span class="overlay-ja-adicionado">✓ Adicionado</span>' : ""}
			`;

			if (!jaEsta) {
				li.addEventListener("click", () => {
					abrirOverlayPreview(cantico.id, momentoId, () => {
						overlay.remove();
						renderizarFolha();
					});
				});
			}

			listaEl.appendChild(li);
		}
	}

	inputPesquisa.addEventListener("input", renderizarListaOverlay);
	inputPesquisa.focus();

	filtrosEl.addEventListener("click", (e) => {
		const btn = e.target.closest(".filtro-categoria");
		if (!btn) return;
		categoriaAtiva = btn.dataset.categoria;
		filtrosEl.querySelectorAll(".filtro-categoria").forEach(b =>
			b.classList.toggle("ativo", b === btn)
		);
		renderizarListaOverlay();
	});

	document.getElementById("btn-fechar-overlay").addEventListener("click", () => {
		overlay.remove();
	});

	overlay.addEventListener("click", (e) => {
		if (e.target === overlay) overlay.remove();
	});

	renderizarListaOverlay();
}

async function abrirOverlayPreview(canticoId, momentoId, onAdicionar) {
	document.getElementById("overlay-preview-cantico")?.remove();

	const canticoData = await carregarCantico(canticoId);
	if (!canticoData) return;

	const { meta, dados } = canticoData;
	const notacao         = Cancioneiro.preferencias.obter("notacao");
	const mostrarAcordes  = Cancioneiro.preferencias.obter("mostrarAcordes");
	const tomOriginal     = dados.meta.key || meta.tom;
	let semitonsPreview   = 0;

	const overlay = document.createElement("div");
	overlay.id = "overlay-preview-cantico";

	function tomApresentado(semitons) {
		const tom = transporAcorde(tomOriginal, semitons);
		return notacao === "latino"
			? Cancioneiro.parser.converterAcorde(tom, "latino")
			: tom;
	}

	function construirOverlay() {
		const letra = renderizarLetraCantico(dados, {
			seccoes: null,
			semitons: semitonsPreview,
			mostrarAcordes,
			notacao
		});

		overlay.innerHTML = `
			<div id="overlay-preview-interior">
				<div id="overlay-preview-cabecalho">
					<button id="btn-voltar-overlay">← Voltar</button>
					<div id="overlay-preview-acoes">
						${mostrarAcordes ? `
							<div class="transposicao-controlo transposicao-inline">
								<button id="preview-transp-menos">−</button>
								<span id="preview-transp-valor">${tomApresentado(semitonsPreview)}</span>
								<button id="preview-transp-mais">+</button>
								<button id="preview-transp-reset">Repor</button>
							</div>
						` : ""}
						<button id="btn-adicionar-do-preview">Adicionar</button>
					</div>
				</div>
				<div id="overlay-preview-conteudo">
					<h3 id="overlay-preview-titulo">${dados.meta.title || meta.titulo}</h3>
					<div id="overlay-preview-meta">${meta.autor} · Tom: ${tomApresentado(semitonsPreview)}</div>
					<div id="overlay-preview-letra">${letra}</div>
				</div>
			</div>
		`;

		document.body.appendChild(overlay);

		// Transposição
		document.getElementById("preview-transp-mais")?.addEventListener("click", () => {
			semitonsPreview++;
			atualizarPreview();
		});
		document.getElementById("preview-transp-menos")?.addEventListener("click", () => {
			semitonsPreview--;
			atualizarPreview();
		});
		document.getElementById("preview-transp-reset")?.addEventListener("click", () => {
			semitonsPreview = 0;
			atualizarPreview();
		});

		// Voltar
		document.getElementById("btn-voltar-overlay").addEventListener("click", () => {
			overlay.remove();
		});

		// Adicionar
		document.getElementById("btn-adicionar-do-preview").addEventListener("click", () => {
			Cancioneiro.folhas.adicionarCantico(estadoFolha.folha.id, momentoId, canticoId);
			// Aplica transposição se diferente de 0
			if (semitonsPreview !== 0) {
				const folha   = Cancioneiro.folhas.obter(estadoFolha.folha.id);
				const momento = folha.momentos.find(m => m.id === momentoId);
				const entrada = momento?.canticos.find(c => c.canticoId === canticoId);
				if (entrada) {
					entrada.tom = semitonsPreview;
					Cancioneiro.folhas.guardar(folha);
				}
			}
			estadoFolha.folha = Cancioneiro.folhas.obter(estadoFolha.folha.id);
			overlay.remove();
			onAdicionar();
		});

		overlay.addEventListener("click", (e) => {
			if (e.target === overlay) {
				overlay.remove();
			}
		});
	}
	

	function atualizarPreview() {
		const letra = renderizarLetraCantico(dados, {
			seccoes: null,
			semitons: semitonsPreview,
			mostrarAcordes,
			notacao
		});
		document.getElementById("overlay-preview-letra").innerHTML = letra;
		const tomEl = document.getElementById("preview-transp-valor");
		if (tomEl) tomEl.textContent = tomApresentado(semitonsPreview);
		const metaEl = document.getElementById("overlay-preview-meta");
		if (metaEl) metaEl.textContent = `${meta.autor} · Tom: ${tomApresentado(semitonsPreview)}`;
	}

	construirOverlay();
}


// -----------------------------------------------------------------------------
// SECÇÃO 8: Cabeçalho
// -----------------------------------------------------------------------------

function inicializarCabecalho() {
	const folha      = estadoFolha.folha;
	const tituloEl   = document.getElementById("folha-titulo");
	const navTipo    = document.getElementById("folha-nav-tipo");
	const btnContinuo   = document.getElementById("btn-nav-continuo");
	const btnIndividual = document.getElementById("btn-nav-individual");

	tituloEl.textContent = folha.titulo;
	document.title = folha.titulo;

	const dataFormatada = folha.data
		? new Date(folha.data + "T00:00:00").toLocaleDateString("pt-PT", {
			day: "numeric", month: "long", year: "numeric"
		})
	: "";
	document.getElementById("folha-meta").textContent =
	[dataFormatada, folha.notas].filter(Boolean).join(" · ");

	// Editar título
	document.getElementById("btn-editar-titulo").addEventListener("click", () => {
		const novoTitulo = prompt("Novo título:", folha.titulo);
		if (novoTitulo && novoTitulo.trim()) {
			estadoFolha.folha.titulo = novoTitulo.trim();
			Cancioneiro.folhas.guardar(estadoFolha.folha);
			tituloEl.textContent = novoTitulo.trim();
			document.title = novoTitulo.trim();
			Cancioneiro.painelFolhas.renderizarLista();
		}
	});

	// Toggle contínuo / individual
	btnContinuo.addEventListener("click", () => {
		estadoFolha.modoNav = "continuo";
		btnContinuo.classList.add("ativo");
		btnIndividual.classList.remove("ativo");
		estadoFolha.momentoAtivo = 0;
		renderizarFolha();
	});

	btnIndividual.addEventListener("click", () => {
		estadoFolha.modoNav = "individual";
		btnIndividual.classList.add("ativo");
		btnContinuo.classList.remove("ativo");
		estadoFolha.momentoAtivo = 0;
		renderizarFolha();
	});

	// Modo editar
	document.getElementById("btn-modo-editar").addEventListener("click", () => {
		estadoFolha.modo = "editar";
		estadoFolha.momentoAtivo = 0;
		document.getElementById("btn-modo-editar").classList.add("ativo");
		document.getElementById("btn-modo-apresentar").classList.remove("ativo");
		document.body.classList.remove("modo-apresentar");
		document.getElementById("btn-editar-titulo").classList.remove("oculto");
		navTipo.classList.add("oculto");
		renderizarFolha();
	});

	// Modo apresentar
	document.getElementById("btn-modo-apresentar").addEventListener("click", () => {
		estadoFolha.modo = "apresentar";
		estadoFolha.momentoAtivo = 0;
		document.getElementById("btn-modo-apresentar").classList.add("ativo");
		document.getElementById("btn-modo-editar").classList.remove("ativo");
		document.body.classList.add("modo-apresentar");
		document.getElementById("btn-editar-titulo").classList.add("oculto");
		navTipo.classList.remove("oculto");
		renderizarFolha();
	});
}


// -----------------------------------------------------------------------------
// SECÇÃO 9: Inicialização
// -----------------------------------------------------------------------------

async function init() {
	const params  = new URLSearchParams(window.location.search);
	const folhaId = params.get("id");

	if (!folhaId) {
		document.getElementById("folha-titulo").textContent = "Folha não encontrada.";
		return;
	}

	const folha = Cancioneiro.folhas.obter(folhaId);
	if (!folha) {
		document.getElementById("folha-titulo").textContent = "Folha não encontrada.";
		return;
	}

	estadoFolha.folha  = folha;
	estadoFolha.indice = await carregarIndice();

	inicializarCabecalho();
	await renderizarFolha();

	document.addEventListener("preferencia-alterada", () => renderizarFolha());
}

init();