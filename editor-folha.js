// editor-folha.js — Lógica da página de edição de uma folha de cânticos

// -----------------------------------------------------------------------------
// SECÇÃO 1: Estado da página
// -----------------------------------------------------------------------------

let estadoFolha = {
	folha: null,
	indice: [],
	canticosCache: {},
	momentoAtivo: 0
};

// -----------------------------------------------------------------------------
// SECÇÃO 2: Carregamento e gravação de dados
// -----------------------------------------------------------------------------

async function carregarIndice() {
	return await window.Cancioneiro.dbApi.carregarIndice();
}

async function carregarCantico(canticoId) {
	if (estadoFolha.canticosCache[canticoId]) {
		return estadoFolha.canticosCache[canticoId];
	}
	const meta = estadoFolha.indice.find(c => c.id === canticoId);
	if (!meta) return null;

	const docData = await window.Cancioneiro.dbApi.carregarCantico(canticoId);
	if (!docData) return null;

	const dados = Cancioneiro.parser.parseChordPro(docData.conteudoChordPro);
	estadoFolha.canticosCache[canticoId] = { meta, dados };
	return estadoFolha.canticosCache[canticoId];
}

async function gravarAlteracoes() {
	if (estadoFolha.folha.tipo === "privada") {
		window.Cancioneiro.folhas.guardar(estadoFolha.folha);
		return;
	}

	try {
		return await window.Cancioneiro.dbApi.atualizarFolha(estadoFolha.folha);
	} catch (e) {
		console.error("Erro a atualizar folha partilhada:", e);
		return false;
	}
}

// -----------------------------------------------------------------------------
// SECÇÃO 3: Renderização da folha (modo edição)
// -----------------------------------------------------------------------------

async function renderizarFolha() {
	const conteudo = document.getElementById("folha-conteudo");
	const notacao = Cancioneiro.preferencias.obter("notacao");
	const mostrarAcordes = Cancioneiro.preferencias.obter("mostrarAcordes");
	conteudo.innerHTML = "";

	const folha = estadoFolha.folha;

	const momentosFiltrados = folha.momentos;

	// Renderiza cada momento
	for (let i = 0; i < momentosFiltrados.length; i++) {
		const momento = momentosFiltrados[i];
		const secDiv = document.createElement("div");
		secDiv.className = "folha-momento";
		secDiv.dataset.index = i;

		// --- Cabeçalho do momento com botões de edição ---
		const cabMomento = document.createElement("div");
		cabMomento.className = "folha-momento-cabecalho";

		const idxReal = folha.momentos.indexOf(momento);
		cabMomento.innerHTML = `
			<h2 class="folha-momento-titulo">${momento.label}</h2>
			<div class="btn-main btn-transparente">
				<button id="btn-renomear-momento" title="Renomear"
					data-id="${momento.id}">✎</button>
				<button id="btn-mover-momento-cima" title="Mover para cima"
					data-idx="${idxReal}" ${idxReal === 0 ? 'disabled' : ''}>↑</button>
				<button id="btn-mover-momento-baixo" title="Mover para baixo"
					data-idx="${idxReal}" ${idxReal === folha.momentos.length - 1 ? 'disabled' : ''}>↓</button>
				<button id="btn-apagar-momento" title="Apagar momento" class="btn-apagar"
					data-id="${momento.id}">✕</button>
			</div>
		`;
		secDiv.appendChild(cabMomento);

		// --- Cânticos do momento ---
		for (const entrada of momento.canticos) {
			const canticoData = await carregarCantico(entrada.canticoId);
			if (!canticoData) continue;

			const { meta, dados } = canticoData;
			const semitons = entrada.tom || 0;
			const tomOriginal = dados.meta.key || meta.tom;
			const tomAtual = transporAcorde(tomOriginal, semitons);

			const tomTexto = notacao === "latino"
				? Cancioneiro.parser.converterAcorde(tomOriginal, "latino")
				: tomOriginal;

			const tomApresentado = notacao === "latino"
				? Cancioneiro.parser.converterAcorde(tomAtual, "latino")
				: tomAtual;

			const letra = renderizarCantico(dados, semitons, entrada.seccoes);

			const canticoDiv = document.createElement("div");
			canticoDiv.className = "folha-cantico cantico-conteudo";
			canticoDiv.dataset.canticoId = entrada.canticoId;
			canticoDiv.dataset.momentoId = momento.id;

			canticoDiv.innerHTML = `
				<div class="folha-cantico-cabecalho">
					<div class="folha-cantico-info">
						<span class="folha-cantico-titulo">${dados.meta.title || meta.titulo}</span>
						<span class="folha-cantico-tom">Tom: ${tomTexto}</span>
						${entrada.notas ? `<span class="folha-cantico-notas">${entrada.notas}</span>` : ""}
					</div>
					<div class="btn-main btn-normal">
						${mostrarAcordes ? `
							<transp-comp id="transp-comp"></transp-comp>
						` : ""}
						
						<button onclick="window.open('cantico.html?id=${entrada.canticoId}', '_blank')">↗</button>
						
						<button id="btn-editar-cantico" data-momento="${momento.id}"
							data-cantico="${entrada.canticoId}" title="Editar">✎</button>
						<button id="btn-apagar-cantico" title="Remover" class="btn-apagar">✕</button>
					</div>
				</div>
				<div class="cantico-letra">${letra}</div>
			`;
			secDiv.appendChild(canticoDiv);
		}

		const container = secDiv.querySelector(".cantico-letra");
		if (container) {
			requestAnimationFrame(() => ajustarTamanhoLetra(container));
			window.addEventListener('resize', () => ajustarTamanhoLetra(container));
		}

		// --- Botão adicionar cântico ---
		const btnAdicionar = document.createElement("button");
		btnAdicionar.className = "btn-adicionar-cantico";
		btnAdicionar.dataset.momento = momento.id;
		btnAdicionar.textContent = "+ Adicionar cântico";
		secDiv.appendChild(btnAdicionar);

		conteudo.appendChild(secDiv);
	}

	// --- Botão adicionar momento ---
	const btnAddMomento = document.createElement("button");
	btnAddMomento.id = "btn-adicionar-momento";
	btnAddMomento.textContent = "+ Adicionar momento";
	conteudo.appendChild(btnAddMomento);

	ligarEventos(momentosFiltrados);
}


// -----------------------------------------------------------------------------
// SECÇÃO 4: Eventos de edição
// -----------------------------------------------------------------------------

function obterEntrada(momentoId, canticoId) {
	const momento = estadoFolha.folha.momentos.find(m => m.id === momentoId);
	return momento?.canticos.find(c => c.canticoId === canticoId) || null;
}

function ligarEventos(momentosFiltrados) {
	const folhaId = estadoFolha.folha.id;

	// Transposição inline
	document.querySelectorAll("#btn-transp-menos").forEach(btn => {
		const canticoDiv = btn.closest(".folha-cantico");
		btn.addEventListener("click", () => {
			const canticoId = canticoDiv.dataset.canticoId;
			const momentoId = canticoDiv.dataset.momentoId;
			const entrada = obterEntrada(momentoId, canticoId);
			if (!entrada) return;
			entrada.tom = ((entrada.tom || 0) - 1) % 12;
			gravarAlteracoes();
			renderizarFolha();
		});
	});

	document.querySelectorAll("#spn-transp-valor").forEach(spn => {
		const canticoDiv = spn.closest(".folha-cantico");
		const canticoId = canticoDiv.dataset.canticoId;
		const momentoId = canticoDiv.dataset.momentoId;
		const entrada = obterEntrada(momentoId, canticoId);
		if (entrada) {
			const canticoData = estadoFolha.canticosCache[canticoId];
			const tomOriginal = canticoData.dados.meta.key || canticoData.meta.tom;
			const semitons = entrada.tom || 0;
			const tomAtual = transporAcorde(tomOriginal, semitons);
			const notacao = Cancioneiro.preferencias.obter("notacao");
			spn.textContent = notacao === "latino"
				? Cancioneiro.parser.converterAcorde(tomAtual, "latino")
				: tomAtual;
		}
	});

	document.querySelectorAll("#btn-transp-mais").forEach(btn => {
		const canticoDiv = btn.closest(".folha-cantico");
		btn.addEventListener("click", () => {
			const canticoId = canticoDiv.dataset.canticoId;
			const momentoId = canticoDiv.dataset.momentoId;
			const entrada = obterEntrada(momentoId, canticoId);
			if (!entrada) return;
			entrada.tom = ((entrada.tom || 0) + 1) % 12;
			gravarAlteracoes();
			renderizarFolha();
		});
	});

	document.querySelectorAll("#btn-transp-reset").forEach(btn => {
		const canticoDiv = btn.closest(".folha-cantico");
		const canticoId = canticoDiv.dataset.canticoId;
		const momentoId = canticoDiv.dataset.momentoId;
		const entrada = obterEntrada(momentoId, canticoId);
		if (!entrada) return;
		const semitons = entrada.tom || 0;
		btn.disabled = semitons === 0;
		btn.addEventListener("click", () => {
			entrada.tom = 0;
			gravarAlteracoes();
			renderizarFolha();
		});
	});

	// Remover cântico
	document.querySelectorAll("#btn-apagar-cantico").forEach(btn => {
		const canticoDiv = btn.closest(".folha-cantico");
		btn.addEventListener("click", () => {
			const canticoId = canticoDiv.dataset.canticoId;
			const momentoId = canticoDiv.dataset.momentoId;
			if (confirm("Remover este cântico da folha?")) {
				Cancioneiro.folhas.removerCantico(folhaId, momentoId, canticoId);
				estadoFolha.folha = Cancioneiro.folhas.obter(folhaId);
				gravarAlteracoes();
				renderizarFolha();
			}
		});
	});

	// Editar entrada (secções + notas)
	document.querySelectorAll("#btn-editar-cantico").forEach(btn => {
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
	document.querySelectorAll("#btn-renomear-momento").forEach(btn => {
		btn.addEventListener("click", () => {
			const momento = estadoFolha.folha.momentos.find(m => m.id === btn.dataset.id);
			if (!momento) return;
			const novoLabel = prompt("Novo nome do momento:", momento.label);
			if (novoLabel && novoLabel.trim()) {
				momento.label = novoLabel.trim();
				gravarAlteracoes();
				renderizarFolha();
			}
		});
	});

	// Mover momento para cima
	document.querySelectorAll("#btn-mover-momento-cima").forEach(btn => {
		btn.addEventListener("click", () => {
			const idx = parseInt(btn.dataset.idx);
			if (idx <= 0) return;
			const momentos = estadoFolha.folha.momentos;
			[momentos[idx - 1], momentos[idx]] = [momentos[idx], momentos[idx - 1]];
			gravarAlteracoes();
			renderizarFolha();
		});
	});

	// Mover momento para baixo
	document.querySelectorAll("#btn-mover-momento-baixo").forEach(btn => {
		btn.addEventListener("click", () => {
			const idx = parseInt(btn.dataset.idx);
			const momentos = estadoFolha.folha.momentos;
			if (idx >= momentos.length - 1) return;
			[momentos[idx], momentos[idx + 1]] = [momentos[idx + 1], momentos[idx]];
			gravarAlteracoes();
			renderizarFolha();
		});
	});

	// Apagar momento
	document.querySelectorAll("#btn-apagar-momento").forEach(btn => {
		btn.addEventListener("click", () => {
			const momento = estadoFolha.folha.momentos.find(m => m.id === btn.dataset.id);
			if (!momento) return;
			if (confirm(`Apagar o momento "${momento.label}"?`)) {
				estadoFolha.folha.momentos = estadoFolha.folha.momentos.filter(
					m => m.id !== btn.dataset.id
				);
				gravarAlteracoes();
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
				gravarAlteracoes();
				renderizarFolha();
			}
		});
	}
}

// -----------------------------------------------------------------------------
// SECÇÃO 5: Modal de edição de entrada (tom + secções + notas)
// -----------------------------------------------------------------------------

async function abrirModalEditarEntrada(momentoId, canticoId) {
	const folha = estadoFolha.folha;
	const momento = folha.momentos.find(m => m.id === momentoId);
	const entrada = momento?.canticos.find(c => c.canticoId === canticoId);
	if (!entrada) return;

	const canticoData = await carregarCantico(canticoId);
	if (!canticoData) return;

	const { meta, dados } = canticoData;

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

	document.getElementById("btn-fechar-modal").addEventListener("click", () => modal.remove());
	document.getElementById("btn-cancelar-modal").addEventListener("click", () => modal.remove());

	document.getElementById("btn-guardar-entrada").addEventListener("click", () => {
		const checkboxes = modal.querySelectorAll("#modal-seccoes input[type=checkbox]");
		const todasChecked = [...checkboxes].every(cb => cb.checked);
		const selecionadas = [...checkboxes]
			.filter(cb => cb.checked)
			.map(cb => cb.value);

		entrada.seccoes = todasChecked ? null : selecionadas;
		entrada.notas = document.getElementById("modal-notas").value.trim();

		gravarAlteracoes();
		modal.remove();
		renderizarFolha();
	});
}

// -----------------------------------------------------------------------------
// SECÇÃO 6: Overlay de adicionar cântico
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
			<div id="overlay-pesquisa-container"></div>
		</div>
	`;

	document.body.appendChild(overlay);

	const pesquisa = new Cancioneiro.Pesquisa(
		"overlay-pesquisa-container",
		estadoFolha.indice,
		(cantico) => {
			abrirOverlayPreview(cantico.id, momentoId);
		}
	);

	document.getElementById("btn-fechar-overlay").addEventListener("click", () => {
		overlay.remove();
	});

	overlay.addEventListener("click", (e) => {
		if (e.target === overlay) {
			overlay.remove();
		}
	});

	pesquisa.input.focus();
}

async function abrirOverlayPreview(canticoId, momentoId) {
	document.getElementById("overlay-preview-cantico")?.remove();

	const canticoData = await carregarCantico(canticoId);
	if (!canticoData) return;

	const { meta, dados } = canticoData;
	const notacao = Cancioneiro.preferencias.obter("notacao");
	const mostrarAcordes = Cancioneiro.preferencias.obter("mostrarAcordes");
	const tomOriginal = dados.meta.key || meta.tom;
	let semitonsPreview = 0;

	const overlay = document.createElement("div");
	overlay.id = "overlay-preview-cantico";

	function tomApresentado(semitons) {
		const tom = transporAcorde(tomOriginal, semitons);
		return notacao === "latino"
			? Cancioneiro.parser.converterAcorde(tom, "latino")
			: tom;
	}

	function construirOverlay() {
		const letra = renderizarCantico(dados, semitonsPreview);

		overlay.innerHTML = `
			<div id="overlay-preview-interior">
				<div id="overlay-preview-cabecalho">
					<button id="btn-voltar-overlay" class="btn-transparente btn-voltar">← Voltar</button>
					<div class="btn-header btn-normal">
						<button id="btn-adicionar-do-preview" class="btn-texto">Adicionar</button>
						${mostrarAcordes ? `
							<transp-comp id="preview-transp-comp"></transp-comp>
						` : ""}
					</div>
				</div>
				<div id="overlay-preview-conteudo">
					<h3 id="overlay-preview-titulo">${dados.meta.title || meta.titulo}</h3>
					<div id="overlay-preview-meta">${meta.autor} · Tom: ${converterAcorde(tomOriginal, notacao)}</div>
					<div id="overlay-preview-letra">${letra}</div>
				</div>
			</div>
		`;

		document.body.appendChild(overlay);

		const container = document.getElementById("overlay-preview-letra");
		requestAnimationFrame(() => ajustarTamanhoLetra(container));
		window.addEventListener('resize', () => ajustarTamanhoLetra(container));

		const tomPreview = document.querySelector("#preview-transp-comp #spn-transp-valor");
		if (tomPreview) { tomPreview.textContent = `${tomApresentado(semitonsPreview)}`; }

		document.querySelector("#preview-transp-comp #btn-transp-menos")?.addEventListener("click", () => {
			semitonsPreview = (semitonsPreview - 1 + 12) % 12;
			atualizarPreview();
		});

		document.querySelector("#preview-transp-comp #btn-transp-mais")?.addEventListener("click", () => {
			semitonsPreview = (semitonsPreview + 1) % 12;
			atualizarPreview();
		});

		const btnReset = document.querySelector("#preview-transp-comp #btn-transp-reset");
		btnReset?.addEventListener("click", () => {
			semitonsPreview = 0;
			atualizarPreview();
		});
		btnReset.disabled = semitonsPreview === 0;

		document.getElementById("btn-voltar-overlay").addEventListener("click", () => {
			overlay.remove();
		});

		document.getElementById("btn-adicionar-do-preview").addEventListener("click", () => {
			const momento = estadoFolha.folha.momentos.find(m => m.id === momentoId);
			if (momento && !momento.canticos.some(c => c.canticoId === canticoId)) {
				momento.canticos.push({
					canticoId: canticoId,
					seccoes: null,
					tom: semitonsPreview !== 0 ? semitonsPreview : null,
					notas: ""
				});
				gravarAlteracoes();
				renderizarFolha();
			}

			document.getElementById("overlay-preview-cantico")?.remove();
			document.getElementById("overlay-adicionar-cantico")?.remove();
		});

		overlay.addEventListener("click", (e) => {
			if (e.target === overlay) {
				overlay.remove();
			}
		});
	}

	function atualizarPreview() {
		const letra = renderizarCantico(dados, semitonsPreview);
		const container = document.getElementById("overlay-preview-letra")
		container.innerHTML = letra;
		requestAnimationFrame(() => ajustarTamanhoLetra(container));
		window.addEventListener('resize', () => ajustarTamanhoLetra(container));

		const tomPreview = document.querySelector("#preview-transp-comp #spn-transp-valor");
		if (tomPreview) { tomPreview.textContent = `${tomApresentado(semitonsPreview)}`; }

		const btnReset = document.querySelector("#preview-transp-comp #btn-transp-reset");
		btnReset.disabled = semitonsPreview === 0;
	}

	construirOverlay();
}

// -----------------------------------------------------------------------------
// SECÇÃO 7: Cabeçalho (edição completa)
// -----------------------------------------------------------------------------

function inicializarCabecalho() {
	const folha = estadoFolha.folha;
	const tituloEl = document.getElementById("folha-titulo");
	const navComp = document.getElementById("nav-comp");
	const btnPartilhar = document.getElementById("btn-partilhar-folha");

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
	document.getElementById("btn-editar-folha").addEventListener("click", async () => {
		const novoTitulo = prompt("Novo título:", folha.titulo);
		if (novoTitulo && novoTitulo.trim()) {
			estadoFolha.folha.titulo = novoTitulo.trim();
			await gravarAlteracoes();
			tituloEl.textContent = novoTitulo.trim();
			document.title = novoTitulo.trim();
		}
	});

	// Apagar folha
	document.getElementById("btn-apagar-folha").addEventListener("click", async () => {
		if (confirm("Tem a certeza que quer apagar esta folha? Esta ação não pode ser desfeita.")) {
			if (estadoFolha.folha.tipo === "privada") {
				Cancioneiro.folhas.apagar(folha.id);
			} else {
				const sucesso = await window.Cancioneiro.dbApi.apagarFolha(folha.tipo, folha.id);
				if (!sucesso) {
					alert("Não foi possível apagar a folha");
					return;
				}
			}

			window.location.href = "./";
		}
	});

    // Visualizar folha (modo leitura)
	document.getElementById("btn-visualizar-folha").addEventListener("click", () => {
		window.location.href = `folha.html?id=${folha.id}`;
	});
}

// -----------------------------------------------------------------------------
// SECÇÃO 8: Inicialização
// -----------------------------------------------------------------------------

async function init() {
	const params = new URLSearchParams(window.location.search);
	const folhaId = params.get("id");

	let folhaCarregada = null;

	if (folhaId) {
		folhaCarregada = Cancioneiro.folhas.obter(folhaId);

		if (!folhaCarregada) {
			if (folhaCarregada = await window.Cancioneiro.dbApi.carregarFolha("publica", folhaId));
			else if (folhaCarregada = await window.Cancioneiro.dbApi.carregarFolha("partilhada", folhaId));
		}
	}

	if (!folhaCarregada) {
		document.getElementById("folha-titulo").textContent = "Folha não encontrada ou link inválido.";
		return;
	}

	estadoFolha.folha = folhaCarregada;
	estadoFolha.indice = await carregarIndice();

	inicializarCabecalho();
	await renderizarFolha();

	document.addEventListener("preferencia-alterada", () => renderizarFolha());

	if (window.gtag) {
		gtag('event', 'page_view', {
			page_path: `/editor-folha.html?id=${folhaId}`,
			page_title: document.title,
			folha_id: folhaId,
			folha_titulo: estadoFolha.folha.titulo
		});
	}
}

init();