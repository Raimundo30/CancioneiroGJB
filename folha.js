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

let isFolhaOnline = false;
let authCodeSession = null;

// -----------------------------------------------------------------------------
// SECÇÃO 2: Carregamento de dados
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
	if (!isFolhaOnline) {
		window.Cancioneiro.folhas.guardar(estadoFolha.folha);
		return;
	}

	if (!authCodeSession) {
		const codigoFornecido = prompt("Insere o código de autenticação para editares esta folha online:");
		if (!codigoFornecido) return; 
		
		const sucesso = await atualizarNaBaseDeDados(estadoFolha.folha, codigoFornecido);
		
		if (sucesso) {
			authCodeSession = codigoFornecido;
			alert("Autenticado com sucesso. As próximas alterações serão gravadas automaticamente.");
			return true;
		} else {
			alert("Código de autenticação incorreto.");
			return false;
		}
	} else {
		const sucesso = await atualizarNaBaseDeDados(estadoFolha.folha, authCodeSession);
		if (!sucesso) {
			alert("Sessão inválida. A folha não foi guardada.");
			authCodeSession = null;
			return false;
		}
		return true;
	}
}

async function atualizarNaBaseDeDados(dadosFolha, codigo) {
	try {
		return await window.Cancioneiro.dbApi.atualizarFolhaPartilhada(dadosFolha.id, dadosFolha, codigo);
	} catch (e) {
		console.error("Erro a atualizar folha partilhada:", e);
		return false;
	}
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

		const container = secDiv.querySelector(".cantico-letra");
		if (container) {
			// Executa depois de renderizar
			requestAnimationFrame(() => ajustarTamanhoLetra(container));
			// Atualiza se a janela for redimensionada
			window.addEventListener('resize', () => ajustarTamanhoLetra(container));
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
			// Só grava se offline ou (editar e online)
			if (!isFolhaOnline || (estadoFolha.folha.editar === true && isFolhaOnline)) {
				gravarAlteracoes();
			}
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
			// Só grava se offline ou (editar e online)
			if (!isFolhaOnline || (estadoFolha.folha.editar === true && isFolhaOnline)) {
				gravarAlteracoes();
			}
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
			// Só grava se offline ou (editar e online)
			if (!isFolhaOnline || (estadoFolha.folha.editar === true && isFolhaOnline)) {
				gravarAlteracoes();
			}
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

	// Botões de edição de momentos (renomear, mover, apagar)
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
			console.log("Apagar momento", btn.dataset.id);
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
			<div id="overlay-pesquisa-container" style="display: flex; flex-direction: column; overflow: hidden; padding: 1rem 1.5rem; flex: 1;"></div>
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
		// Executa depois de renderizar
		requestAnimationFrame(() => ajustarTamanhoLetra(container));
		// Atualiza se a janela for redimensionada
		window.addEventListener('resize', () => ajustarTamanhoLetra(container));

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
		// Executa depois de renderizar
		requestAnimationFrame(() => ajustarTamanhoLetra(container));
		// Atualiza se a janela for redimensionada
		window.addEventListener('resize', () => ajustarTamanhoLetra(container));

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
			if (isFolhaOnline) {
				let codigo = authCodeSession;
				if (!codigo) {
					codigo = prompt("Insere o código de autenticação para apagares esta folha online:");
					if (!codigo) return; // O utilizador cancelou
				}
				
				const sucesso = await window.Cancioneiro.dbApi.apagarFolhaPartilhada(folha.id, codigo);
				if (!sucesso) {
					alert("Não foi possível apagar a folha. O código está incorreto.");
					return; // Para a execução, não redireciona
				}
			} else {
				Cancioneiro.folhas.apagar(folha.id);
			}
			
			window.location.href = "index.html";
		}
	});

	// Lógica Partilhar / Guardar Folha
	const isShared = isFolhaOnline; // Atualizado para usar a nova flag
	if (isShared) {
		btnPartilhar.title = "Guardar nesta App";
		btnPartilhar.textContent = "⬇"; // ou "💾"
		
		btnPartilhar.addEventListener("click", () => {
			const folhaClone = JSON.parse(JSON.stringify(estadoFolha.folha));
			folhaClone.id = Cancioneiro.folhas.gerarId ? Cancioneiro.folhas.gerarId() : "f" + Date.now().toString(36);
			folhaClone.editar = true;
			
			const folhasGerais = Cancioneiro.folhas.listar();
			folhasGerais.push(folhaClone);
			localStorage.setItem("cancioneiro_folhas", JSON.stringify(folhasGerais));
			
			alert("Cópia guardada com sucesso nos teus dispositivos!");
			window.location.href = `folha.html?id=${folhaClone.id}`;
		});
		
	} else {
		btnPartilhar.title = "Partilhar folha online";
		btnPartilhar.addEventListener("click", async () => {
			const senha = prompt("Cria uma senha secreta para permitir editar esta folha no futuro:");
			if (!senha) return; // Utilizador cancelou

			try {
				// Guarda no Firebase
				const novoId = await window.Cancioneiro.dbApi.criarFolhaPartilhada(folha, senha);
				
				// Apaga do armazenamento local para passar a ser 100% online
				Cancioneiro.folhas.apagar(folha.id);
				
				const linkPartilha = window.location.href.split('?')[0] + "?id=" + novoId;
				navigator.clipboard.writeText(linkPartilha).then(() => {
					alert("Folha publicada na nuvem! Link copiado para a área de transferência.");
				}).catch(() => {
					alert("Folha publicada! Copie este link: " + linkPartilha);
				});

				// Redireciona para a nova folha online
				window.location.href = linkPartilha;
			} catch (error) {
				console.error(error);
				alert("Erro ao publicar a folha.");
			}
		});
	}

	// Como o painel carrega de forma assíncrona, configuramos as opções apenas quando este existir
    function configurarTogglesPainel() {
        const seccaoPainel = document.getElementById("painel-definicoes-folha");
        if (!seccaoPainel) return;

        // Mostra a secção de opções da folha no painel
        seccaoPainel.style.display = "block";

        const toggleEditar = document.getElementById("toggle-folha-editar");
        const togglePagina = document.getElementById("toggle-folha-pagina");
        const toggleMeta   = document.getElementById("toggle-folha-meta");

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
        toggleEditar.addEventListener("change", async () => {
            const valorAnterior = folha.editar;
            folha.editar = toggleEditar.checked;
            
            const sucesso = await gravarAlteracoes();
            if (sucesso === false) {
                folha.editar = valorAnterior; // Reverte se falhar
                toggleEditar.checked = valorAnterior;
                alert("Não foi possível alterar o modo de edição. Tente novamente.");
                return;
            }

            aplicarVisibilidadeCabecalho();
            renderizarFolha();
        });

        // Toggle contínuo / individual
        togglePagina.addEventListener("change", async () => {
            folha.verPaginas = togglePagina.checked;
            // await gravarAlteracoes();
            aplicarVisibilidadeCabecalho();
            renderizarFolha();
        });
    }

    if (window.Cancioneiro.painelPronto) {
        configurarTogglesPainel();
    } else {
        document.addEventListener("painel-pronto", configurarTogglesPainel);
    }
}


// -----------------------------------------------------------------------------
// SECÇÃO 8: Inicialização
// -----------------------------------------------------------------------------

async function init() {
	const params  = new URLSearchParams(window.location.search);
	const folhaId = params.get("id");

	let folhaCarregada = null;
	isFolhaOnline = false;

	if (folhaId) {
		// Tenta carregar localmente
		folhaCarregada = Cancioneiro.folhas.obter(folhaId);

		// Se não existir localmente, tenta na nuvem (Firebase)
		if (!folhaCarregada) {
			folhaCarregada = await window.Cancioneiro.dbApi.carregarFolhaPartilhada(folhaId);
			if (folhaCarregada) {
				isFolhaOnline = true;
				// Assegura que a ID da folha carregada corresponda ao parâmetro
				folhaCarregada.id = folhaId; 
				
				// Desativa sempre o modo de edição ao carregar a página
				folhaCarregada.editar = false;
			}
		}
	}

	if (!folhaCarregada) {
		document.getElementById("folha-titulo").textContent = "Folha não encontrada ou link inválido.";
		return;
	}

	estadoFolha.folha  = folhaCarregada;
	estadoFolha.indice = await carregarIndice();

	inicializarCabecalho();
	await renderizarFolha();

	document.addEventListener("preferencia-alterada", () => renderizarFolha());
}

// Google Analytics: envia evento de page_view para cada folha aberta
if (window.gtag) {
	gtag('event', 'page_view', {
		page_path: window.location.pathname + window.location.search,
		page_title: document.title
	});
}

init();