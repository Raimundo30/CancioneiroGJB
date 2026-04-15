// folha.js — Lógica da página de uma folha de cânticos

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
// SECÇÃO 3: Renderização da folha
// -----------------------------------------------------------------------------

async function renderizarFolha() {
	const conteudo      = document.getElementById("folha-conteudo");
	const notacao       = Cancioneiro.preferencias.obter("notacao");
	const mostrarAcordes = Cancioneiro.preferencias.obter("mostrarAcordes");
	conteudo.innerHTML  = "";

	const folha = estadoFolha.folha;
	const editar = folha.editar !== false; 
	const verPaginas = folha.verPaginas === true;

	const momentosFiltrados = folha.momentos.filter(
		m => editar === true || m.canticos.length > 0
	);

	// Renderiza cada momento
	for (let i = 0; i < momentosFiltrados.length; i++) {
		const momento = momentosFiltrados[i];
		const oculto = editar === false &&
						verPaginas === true &&
						i !== estadoFolha.momentoAtivo ? "oculto" : "";
		const secDiv = document.createElement("div");
		secDiv.className = `folha-momento ${oculto}`;
		secDiv.dataset.index = i;

		// --- Cabeçalho do momento ---
		const cabMomento = document.createElement("div");
		cabMomento.className = "folha-momento-cabecalho";

		if (editar === true) {
			const idxReal = folha.momentos.indexOf(momento);
			cabMomento.innerHTML = `
				<h2 class="folha-momento-titulo">${momento.label}</h2>
				<div class="btn-transparente">
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

			const tomTexto = notacao === "latino"
				? Cancioneiro.parser.converterAcorde(tomOriginal, "latino")
				: tomOriginal;

			const tomApresentado = notacao === "latino"
				? Cancioneiro.parser.converterAcorde(tomAtual, "latino")
				: tomAtual;

			const letra = renderizarCantico(dados, semitons);

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
						
						${editar === true ? `
							<button id="btn-editar-cantico" data-momento="${momento.id}"
								data-cantico="${entrada.canticoId}" title="Editar">✎</button>
							<button id="btn-apagar-cantico" title="Remover" class="btn-apagar">✕</button>
						` : ""}
					</div>
				</div>
				<div class="cantico-letra">${letra}</div>
			`;
			secDiv.appendChild(canticoDiv);
		}

		// --- Botão adicionar cântico (modo editar) ---
		if (editar === true) {
			const btnAdicionar = document.createElement("button");
			btnAdicionar.className = "btn-adicionar-cantico";
			btnAdicionar.dataset.momento = momento.id;
			btnAdicionar.textContent = "+ Adicionar cântico";
			secDiv.appendChild(btnAdicionar);
		}

		conteudo.appendChild(secDiv);
	}

	// --- Botão adicionar momento (modo editar, no final) ---
	if (editar === true) {
		const btnAddMomento = document.createElement("button");
		btnAddMomento.id = "btn-adicionar-momento";
		btnAddMomento.textContent = "+ Adicionar momento";
		conteudo.appendChild(btnAddMomento);
	}

	ligarEventos(momentosFiltrados);

	// Renderiza navegação entre momentos se estiver em modo apresentar individual
	if (!editar && verPaginas) {
		atualizarNavegacao(momentosFiltrados);
	}
}


// -----------------------------------------------------------------------------
// SECÇÃO 4: Eventos
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
			Cancioneiro.folhas.guardar(estadoFolha.folha);
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
			const semitons    = entrada.tom || 0;
			const tomAtual    = transporAcorde(tomOriginal, semitons);
			const notacao     = Cancioneiro.preferencias.obter("notacao");
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
			Cancioneiro.folhas.guardar(estadoFolha.folha);
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
			const canticoId = canticoDiv.dataset.canticoId;
			const momentoId = canticoDiv.dataset.momentoId;
			const entrada = obterEntrada(momentoId, canticoId);
			if (!entrada) return;
			entrada.tom = 0;
			Cancioneiro.folhas.guardar(estadoFolha.folha);
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

	// Botões de edição de momentos (renomear, mover, apagar)
	// Renomear momento
	document.querySelectorAll("#btn-renomear-momento").forEach(btn => {
		
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
	document.querySelectorAll("#btn-mover-momento-cima").forEach(btn => {
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
	document.querySelectorAll("#btn-mover-momento-baixo").forEach(btn => {
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
	document.querySelectorAll("#btn-apagar-momento").forEach(btn => {
		btn.addEventListener("click", () => {
			console.log("Apagar momento", btn.dataset.id);
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
	const btnAnterior = document.getElementById("btn-anterior");
	const btnSeguinte = document.getElementById("btn-seguinte");

	if (btnAnterior) {
		btnAnterior.disabled = estadoFolha.momentoAtivo <= 0;
		btnAnterior.onclick = () => {
		if (estadoFolha.momentoAtivo > 0) {
			estadoFolha.momentoAtivo--;
			renderizarFolha();
		}
		};
	}
	if (btnSeguinte) {
		btnSeguinte.disabled = estadoFolha.momentoAtivo >= momentosFiltrados.length - 1;
		btnSeguinte.onclick = () => {
			if (estadoFolha.momentoAtivo < momentosFiltrados.length - 1) {
				estadoFolha.momentoAtivo++;
				renderizarFolha();
			}
		};
	}
}

function atualizarNavegacao(momentosFiltrados) {
	const navComp    = document.getElementById("nav-comp");
	const btnIndice  = document.getElementById("btn-indice");

	if (!navComp || !btnIndice) return;

	const folha = estadoFolha.folha;
	const editar = folha.editar !== false;
	const verPaginas = folha.verPaginas === true;

	const verPaginasAtiva = editar === false && verPaginas === true && momentosFiltrados.length > 1;

	if (verPaginasAtiva) {
		navComp.classList.remove("oculto");
		
		// Cria o nav-dropdown dinamicamente se não existir
		let navDropdown = document.getElementById("folha-nav-dropdown");
		if (!navDropdown) {
			navDropdown = document.createElement("ul");
			navDropdown.id = "folha-nav-dropdown";
			navDropdown.className = "dropdown oculto";
			navComp.appendChild(navDropdown);

			// Eventos para abrir e fechar o menu adicionados apenas ao criar
			btnIndice.addEventListener("click", (e) => {
				navDropdown.classList.toggle("oculto");
			});

			document.addEventListener("click", (e) => {
				if (!navDropdown.contains(e.target) && e.target !== btnIndice) {
					navDropdown.classList.add("oculto");
				}
			});
		}

		// Preenche a lista com os momentos
		navDropdown.innerHTML = "";
		momentosFiltrados.forEach((m, i) => {
			const li = document.createElement("li");
			li.textContent = m.label;
			if (i === estadoFolha.momentoAtivo) {
				li.classList.add("ativo");
			}

			li.addEventListener("click", () => {
				estadoFolha.momentoAtivo = i;
				navDropdown.classList.add("oculto");
				renderizarFolha();
			});

			navDropdown.appendChild(li);
		});
	} else {
		navComp.classList.add("oculto");
	}
}


// -----------------------------------------------------------------------------
// SECÇÃO 5: Modal de edição de entrada (tom + secções + notas)
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
		const letra = renderizarCantico(dados, semitonsPreview);

		overlay.innerHTML = `
			<div id="overlay-preview-interior">
				<div id="overlay-preview-cabecalho">
					<button id="btn-voltar-overlay" class="btn-transparente btn-voltar">← Voltar</button>
					<div class="btn-header btn-normal">
						${mostrarAcordes ? `
							<transp-comp id="preview-transp-comp"></transp-comp>
						` : ""}
						<button id="btn-adicionar-do-preview" class="btn-texto">Adicionar</button>
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

		// Transposição
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
		const letra = renderizarCantico(dados, semitonsPreview);
		document.getElementById("overlay-preview-letra").innerHTML = letra;

		const tomPreview = document.querySelector("#preview-transp-comp #spn-transp-valor");
		if (tomPreview) { tomPreview.textContent = `${tomApresentado(semitonsPreview)}`; }
	
		const btnReset = document.querySelector("#preview-transp-comp #btn-transp-reset");
		btnReset.disabled = semitonsPreview === 0;
	}

	construirOverlay();
}


// -----------------------------------------------------------------------------
// SECÇÃO 7: Cabeçalho
// -----------------------------------------------------------------------------

function inicializarCabecalho() {
	const folha      = estadoFolha.folha;
	const tituloEl   = document.getElementById("folha-titulo");
	const navComp    = document.getElementById("nav-comp");
	const btnDefinicoes= document.getElementById("btn-folha-definicoes");
	const dropdownDefinicoes = document.getElementById("folha-def-dropdown"); // Selecionado
	const toggleEditar = document.getElementById("toggle-folha-editar");
	const togglePagina = document.getElementById("toggle-folha-pagina");
	const toggleMeta   = document.getElementById("toggle-folha-meta");
	
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
	document.getElementById("btn-editar-folha").addEventListener("click", () => {
		const novoTitulo = prompt("Novo título:", folha.titulo);
		if (novoTitulo && novoTitulo.trim()) {
			estadoFolha.folha.titulo = novoTitulo.trim();
			Cancioneiro.folhas.guardar(estadoFolha.folha);
			tituloEl.textContent = novoTitulo.trim();
			document.title = novoTitulo.trim();
			Cancioneiro.painelFolhas.renderizarLista();
		}
	});

	// Apagar folha
	document.getElementById("btn-apagar-folha").addEventListener("click", () => {
		if (confirm("Tem a certeza que quer apagar esta folha? Esta ação não pode ser desfeita.")) {
			Cancioneiro.folhas.apagar(folha.id);
			window.location.href = "index.html";
		}
	});

	// Toggle dropdown definições
	btnDefinicoes.addEventListener("click", (e) => {
		dropdownDefinicoes.classList.toggle("oculto");
	});

	// Fechar dropdown ao clicar fora
	document.addEventListener("click", (e) => {
		if (!dropdownDefinicoes.contains(e.target) && e.target !== btnDefinicoes) {
			dropdownDefinicoes.classList.add("oculto");
		}
	});

	// Lista de elementos a mostrar/ocultar consoante o modo editar/apresentar
	const listaEditar = [
		document.getElementById("btn-editar-folha"),
		document.getElementById("btn-apagar-folha"),
		document.getElementById("folha-momento-acoes"),
		document.getElementById("btn-editar-entrada"),
		document.getElementById("btn-apagar-cantico")
	];

	const listaApresentar = [
		document.getElementById("opt-folha-pagina"),
		navComp
	];

	function aplicarVisibilidadeCabecalho() {
		const editar     = folha.editar !== false;
		const verPaginas = folha.verPaginas === true;

		if (editar) {
			listaEditar.forEach(el => el?.classList.remove("oculto"));
			listaApresentar.forEach(el => el?.classList.add("oculto"));
		} else {
			listaEditar.forEach(el => el?.classList.add("oculto"));
			listaApresentar.forEach(el => el?.classList.remove("oculto"));
			if (!verPaginas) {
				navComp.classList.add("oculto");
			}
		}
	}
	
	// Estado inicial dos switches
	toggleEditar.checked = folha.editar !== false;
	togglePagina.checked = folha.verPaginas === true;
	aplicarVisibilidadeCabecalho();

	// Toggle editar / apresentar
	toggleEditar.addEventListener("change", () => {
		folha.editar = toggleEditar.checked;
		Cancioneiro.folhas.guardar(folha); // Grava a opção nesta folha específica
		aplicarVisibilidadeCabecalho();
		renderizarFolha();
	});

	// Toggle contínuo / individual
	togglePagina.addEventListener("change", () => {
		folha.verPaginas = togglePagina.checked;
		Cancioneiro.folhas.guardar(folha); // Grava a opção nesta folha específica
		aplicarVisibilidadeCabecalho();
		renderizarFolha();
	});
}


// -----------------------------------------------------------------------------
// SECÇÃO 8: Inicialização
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