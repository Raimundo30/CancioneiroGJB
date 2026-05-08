// folha.js — Lógica da página de visualização de uma folha de cânticos (modo apresentação)

// -----------------------------------------------------------------------------
// SECÇÃO 1: Estado da página
// -----------------------------------------------------------------------------

let estadoFolha = {
	folha: null,
	indice: [],
	canticosCache: {},
	momentoAtivo: 0,
	verPaginas: false,
    ocultarMeta: false
};

const PREF_STORAGE_KEY = "prefs_folha_";

function obterChavePrefs(folhaId) {
	return `${PREF_STORAGE_KEY}${folhaId}`;
}

function carregarPrefsLocais(folhaId) {
	try {
		const dados = localStorage.getItem(obterChavePrefs(folhaId));
		return dados ? JSON.parse(dados) : {};
	} catch (e) {
		console.warn("Erro ao carregar preferências locais:", e);
		return {};
	}
}

function guardarPrefsLocais(folha) {
	const folhaId = folha.id;
	const prefs = extrairPrefsAtuals(folha);

	try {
		localStorage.setItem(obterChavePrefs(folhaId), JSON.stringify(prefs));
	} catch (e) {
		console.warn("Erro ao guardar preferências locais:", e);
	}
}

function extrairPrefsAtuals(folha) {
	const prefs = {
		verPaginas: folha.verPaginas || false,
		ocultarMeta: folha.ocultarMeta || false,
		transposicoes: {}
	};

	folha.momentos.forEach(momento => {
		momento.canticos.forEach(cantico => {
			if (cantico.tom !== undefined && cantico.tom !== 0) {
				prefs.transposicoes[cantico.canticoId] = cantico.tom;
			}
		});
	});

	return prefs;
}

function aplicarPrefsLocais(folha, prefs) {
	if (prefs.verPaginas !== undefined) {
		folha.verPaginas = prefs.verPaginas;
	}
	if (prefs.ocultarMeta !== undefined) {
		folha.ocultarMeta = prefs.ocultarMeta;
	}

	if (prefs.transposicoes) {
		folha.momentos.forEach(momento => {
			momento.canticos.forEach(cantico => {
				if (prefs.transposicoes[cantico.canticoId] !== undefined) {
					cantico.tom = prefs.transposicoes[cantico.canticoId];
				}
			});
		});
	}
}

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

// -----------------------------------------------------------------------------
// SECÇÃO 3: Renderização da folha (modo apresentação)
// -----------------------------------------------------------------------------

async function renderizarFolha() {
	const conteudo = document.getElementById("folha-conteudo");
	const notacao = Cancioneiro.preferencias.obter("notacao");
	const mostrarAcordes = Cancioneiro.preferencias.obter("mostrarAcordes");
	conteudo.innerHTML = "";

	const folha = estadoFolha.folha;
	const verPaginas = folha.verPaginas === true;

	const momentosFiltrados = folha.momentos.filter(
		m => m.canticos.length > 0
	);

	// Renderiza cada momento
	for (let i = 0; i < momentosFiltrados.length; i++) {
		const momento = momentosFiltrados[i];
		const oculto = verPaginas === true && i !== estadoFolha.momentoAtivo ? "oculto" : "";
		const secDiv = document.createElement("div");
		secDiv.className = `folha-momento ${oculto}`;
		secDiv.dataset.index = i;

		// --- Cabeçalho do momento (sem botões de edição) ---
		const cabMomento = document.createElement("div");
		cabMomento.className = "folha-momento-cabecalho";
		cabMomento.innerHTML = `<h2 class="folha-momento-titulo">${momento.label}</h2>`;
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

		conteudo.appendChild(secDiv);
	}

	ligarEventos(momentosFiltrados);

	// Renderiza navegação entre momentos se estiver em modo apresentar individual
	if (verPaginas) {
		atualizarNavegacao(momentosFiltrados);
	}
}


// -----------------------------------------------------------------------------
// SECÇÃO 4: Eventos (transposição e navegação)
// -----------------------------------------------------------------------------

function obterEntrada(momentoId, canticoId) {
	const momento = estadoFolha.folha.momentos.find(m => m.id === momentoId);
	return momento?.canticos.find(c => c.canticoId === canticoId) || null;
}

function ligarEventos(momentosFiltrados) {
	// Transposição inline
	document.querySelectorAll("#btn-transp-menos").forEach(btn => {
		const canticoDiv = btn.closest(".folha-cantico");
		btn.addEventListener("click", () => {
			const canticoId = canticoDiv.dataset.canticoId;
			const momentoId = canticoDiv.dataset.momentoId;
			const entrada = obterEntrada(momentoId, canticoId);
			if (!entrada) return;
			entrada.tom = ((entrada.tom || 0) - 1) % 12;
			guardarPrefsLocais(estadoFolha.folha);
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
			guardarPrefsLocais(estadoFolha.folha);
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
			guardarPrefsLocais(estadoFolha.folha);
			renderizarFolha();
		});
	});

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
	const navComp = document.getElementById("nav-comp");
	const btnIndice = document.getElementById("btn-indice");

	if (!navComp || !btnIndice) return;

	const folha = estadoFolha.folha;
	const verPaginas = folha.verPaginas === true && momentosFiltrados.length > 1;

	if (verPaginas) {
		navComp.classList.remove("oculto");

		let navDropdown = document.getElementById("folha-nav-dropdown");
		if (!navDropdown) {
			navDropdown = document.createElement("ul");
			navDropdown.id = "folha-nav-dropdown";
			navDropdown.className = "dropdown oculto";
			navComp.appendChild(navDropdown);

			btnIndice.addEventListener("click", (e) => {
				navDropdown.classList.toggle("oculto");
			});

			document.addEventListener("click", (e) => {
				if (!navDropdown.contains(e.target) && e.target !== btnIndice) {
					navDropdown.classList.add("oculto");
				}
			});
		}

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
// SECÇÃO 5A: Autenticação e edição
// -----------------------------------------------------------------------------

async function abrirEditor() {
	const folha = estadoFolha.folha;

	// Se for folha privada, vai direto para o editor
	if (folha.tipo === "privada") {
		window.location.href = `editor-folha.html?id=${folha.id}`;
		return;
	}

	// Se for partilhada ou pública, pede autenticação
	const resultado = await window.Cancioneiro.dbApi.authFolha(folha.tipo, folha.id);

	if (resultado.sucesso) {
		window.location.href = `editor-folha.html?id=${folha.id}`;
	} else {
		alert(resultado.erro || "Não foi possível autenticar.");
	}
}

// -----------------------------------------------------------------------------
// SECÇÃO 5B: Partilha de folhas
// -----------------------------------------------------------------------------
async function abrirOverlayPartilha() {
	const folha = estadoFolha.folha;

	// Cria/obtém o overlay
	let overlay = document.getElementById("overlay-partilha");
	if (!overlay) {
		overlay = document.createElement("div");
		overlay.id = "overlay-partilha";
		overlay.className = "overlay overlay-visivel";
		document.body.appendChild(overlay);

		overlay.addEventListener("click", (e) => {
			if (e.target === overlay) fecharOverlayPartilha();
		});
	} else {
		overlay.classList.add("overlay-visivel");
	}

	// Cria/obtém o painel
	let painel = document.getElementById("painel-partilha");
	if (!painel) {
		painel = document.createElement("div");
		painel.id = "painel-partilha";
		painel.className = "painel painel-aberto";
		document.body.appendChild(painel);
	} else {
		painel.classList.add("painel-aberto");
		painel.classList.remove("painel-fechado");
	}

	// Renderiza conteúdo
	painel.innerHTML = `
		<div class="painel-conteudo">
			<div class="painel-cabecalho">
				<h2>Partilhar Folha</h2>
				<button id="btn-fechar-partilha" class="btn-fechar">✕</button>
			</div>

			<div class="painel-corpo">
				<!-- Opções de tipo -->
				<div class="opcao-partilha ${folha.tipo === "privada" ? "opcao-selecionada" : ""}">
					<div class="opcao-info">
						<h3>Privada</h3>
						<p>Apenas você pode aceder</p>
					</div>
					<button class="btn-opcao-partilha" data-tipo="privada" 
							${folha.tipo === "privada" ? "disabled" : ""}>
						${folha.tipo === "privada" ? "Tipo atual" : "Tornar privada"}
					</button>
				</div>

				<div class="opcao-partilha ${folha.tipo === "partilhada" ? "opcao-selecionada" : ""}">
					<div class="opcao-info">
						<h3>Partilhada</h3>
						<p>Qualquer pessoa com link pode aceder e editar</p>
					</div>
					<button class="btn-opcao-partilha" data-tipo="partilhada" 
							${folha.tipo === "partilhada" ? "disabled" : ""}>
						${folha.tipo === "partilhada" ? "Tipo atual" : "Tornar partilhada"}
					</button>
				</div>

				<div class="opcao-partilha ${folha.tipo === "publica" ? "opcao-selecionada" : ""}">
					<div class="opcao-info">
						<h3>Pública</h3>
						<p>Qualquer pessoa pode ver (leitura apenas)</p>
					</div>
					<button class="btn-opcao-partilha" data-tipo="publica" 
							${folha.tipo === "publica" ? "disabled" : ""}>
						${folha.tipo === "publica" ? "Tipo atual" : "Tornar pública"}
					</button>
				</div>

				<!-- Seção compartilhamento -->
				${folha.tipo !== "privada" ? `
					<div class="secao-compartilhamento">
						<h3>Partilhar esta folha</h3>
						
						<div class="grupo-link">
							<label>Link:</label>
							<div class="link-container">
								<input type="text" id="inp-link-partilha" readonly 
									value="${gerarLinkPartilha(folha.id)}">
								<button id="btn-copiar-link" class="btn-secundario">Copiar</button>
							</div>
						</div>

						<div class="grupo-qrcode">
							<label>QR Code:</label>
							<div id="container-qrcode"></div>
						</div>

						${folha.tipo !== "publica" ? `
							<div class="grupo-codigo-edicao">
								<label>Código de edição:</label>
								<div class="codigo-container">
									<input type="text" id="inp-codigo-edicao" readonly 
										value="${folha.codigoEdicao || "---"}">
									<button id="btn-copiar-codigo" class="btn-secundario">Copiar</button>
								</div>
							</div>
						` : ""}
					</div>
				` : ""}

				<!-- Guardar cópia -->
				${folha.tipo !== "privada" ? `
					<div class="secao-copiar">
						<h3>Guardar nesta App</h3>
						<p>Cria uma cópia privada desta folha no seu dispositivo</p>
						<button id="btn-copiar-folha-privada" class="btn-primario">⬇ Guardar cópia</button>
					</div>
				` : ""}
			</div>
		</div>
	`;

	// Eventos dos botões
	ligarEventosPartilha();
}

function ligarEventosPartilha() {
	// Fechar
	document.getElementById("btn-fechar-partilha")?.addEventListener("click", fecharOverlayPartilha);

	// Mudar tipo
	document.querySelectorAll(".btn-opcao-partilha:not([disabled])").forEach(btn => {
		btn.addEventListener("click", async () => {
			await alterarTipoFolha(btn.dataset.tipo);
			abrirOverlayPartilha();
		});
	});

	const folha = estadoFolha.folha;
	if (folha.tipo !== "privada") {
		// Copiar link
		document.getElementById("btn-copiar-link")?.addEventListener("click", () => {
			const input = document.getElementById("inp-link-partilha");
			input.select();
			document.execCommand("copy");
			alert("Link copiado!");
		});

		// QR Code
		gerarQRCode(gerarLinkPartilha(folha.id));

		// Copiar código
		if (folha.tipo !== "publica") {
			document.getElementById("btn-copiar-codigo")?.addEventListener("click", () => {
				const input = document.getElementById("inp-codigo-edicao");
				input.select();
				document.execCommand("copy");
				alert("Código copiado!");
			});
		}

		// Guardar cópia
		document.getElementById("btn-copiar-folha-privada")?.addEventListener("click", guardarCopiaPrivada);
	}
}

function fecharOverlayPartilha() {
	const overlay = document.getElementById("overlay-partilha");
	const painel = document.getElementById("painel-partilha");

	overlay?.classList.remove("overlay-visivel");
	painel?.classList.remove("painel-aberto");
	painel?.classList.add("painel-fechado");
}

function gerarLinkPartilha(folhaId) {
	const baseUrl = window.location.origin + window.location.pathname.replace("folha.html", "");
	return `${baseUrl}folha.html?id=${folhaId}`;
}

function gerarQRCode(url) {
	const container = document.getElementById("container-qrcode");
	if (!container) return;

	const qrcodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`;
	const img = document.createElement("img");
	img.src = qrcodeUrl;
	img.alt = "QR Code";
	img.className = "qrcode-imagem";

	container.innerHTML = "";
	container.appendChild(img);
}

async function alterarTipoFolha(novoTipo) {
	const folha = estadoFolha.folha;

	if (folha.tipo === novoTipo) return;

	try {
		const resultado = await window.Cancioneiro.dbApi.moverFolha(
			folha.tipo,
			novoTipo,
			folha.id
		);

		if (!resultado.sucesso) {
			alert("Erro ao alterar tipo: " + (resultado.erro || "Desconhecido"));
			return;
		}

		estadoFolha.folha.tipo = novoTipo;

		// Se foi gerado um novo código, atualiza o estado
		//if (resultado.codigo) {
		//	estadoFolha.folha.codigoEdicao = resultado.codigo;
		//}

		alert("Tipo de folha alterado com sucesso!");
	} catch (error) {
		console.error("Erro ao alterar tipo:", error);
		alert("Erro: " + error.message);
	}
}

function guardarCopiaPrivada() {
	const folha = estadoFolha.folha;
	const folhaClone = JSON.parse(JSON.stringify(folha));

	// Remove campos de Firebase
	delete folhaClone.id;
	delete folhaClone.codigoHash;
	delete folhaClone.codigoSalt;
	delete folhaClone.codigoEdicao;
	delete folhaClone.dataCriacao;
	delete folhaClone.dataModificacao;
	folhaClone.tipo = "privada";

	// Cria e guarda localmente
	const resultado = window.Cancioneiro.folhas.criar(folhaClone.titulo, folhaClone.data, folhaClone.notas);
	resultado.momentos = folhaClone.momentos;
	window.Cancioneiro.folhas.guardar(resultado);

	alert("Cópia guardada com sucesso!");
	window.location.href = `editor-folha.html?id=${resultado.id}`;
}

// -----------------------------------------------------------------------------
// SECÇÃO 5: Cabeçalho (visualização apenas)
// -----------------------------------------------------------------------------

function inicializarCabecalho() {
	const folha = estadoFolha.folha;
	const tituloEl = document.getElementById("folha-titulo");

	tituloEl.textContent = folha.titulo;
	document.title = folha.titulo;

	const dataFormatada = folha.data
		? new Date(folha.data + "T00:00:00").toLocaleDateString("pt-PT", {
			day: "numeric", month: "long", year: "numeric"
		})
		: "";
	document.getElementById("folha-meta").textContent =
		[dataFormatada, folha.notas].filter(Boolean).join(" · ");

	// Botão de editar
	const btnEditar = document.getElementById("btn-editar-folha");
	if (btnEditar) {
		btnEditar.addEventListener("click", abrirEditor);
	}

	// Botão de partilhar
	const btnPartilhar = document.getElementById("btn-partilhar-folha");
	if (btnPartilhar) {
		btnPartilhar.addEventListener("click", () => {
			abrirOverlayPartilha();
        });
	}
	// Abre overlay com as três opções: Privada, Partilhada, Pública
	// tipo atual está bloqueado
	// Botão para criar cópia da folha na app (privada)
	// ao primir partilhada ou pública, tenta autenticar
		// com a autenticação sucedida, move folha para o tipo correspondente
	// Caso seja partilhada ou pública:
		// mostra link com opção para copiar e QR code
		// Caso admin esteja autenticado, mostra código de edição


	function configurarTogglesPainel() {
		const seccaoPainel = document.getElementById("painel-definicoes-folha");
		if (!seccaoPainel) return;

		seccaoPainel.style.display = "block";

		// Toggle "Ver por página"
		const toggleVerPaginas = document.getElementById("toggle-folha-verPaginas");
		if (toggleVerPaginas) {
			toggleVerPaginas.checked = folha.verPaginas === true;
			toggleVerPaginas.addEventListener("change", () => {
				folha.verPaginas = toggleVerPaginas.checked;
				guardarPrefsLocais(folha);
				renderizarFolha();
			});
		}

		// Toggle "Ocultar meta"
		const toggleMeta = document.getElementById("toggle-folha-meta");
		if (toggleMeta) {
			toggleMeta.checked = folha.ocultarMeta === true;
			toggleMeta.addEventListener("change", () => {
				folha.ocultarMeta = toggleMeta.checked;
				guardarPrefsLocais(folha);
				const metaEl = document.getElementById("folha-meta");
				if (metaEl) {
					metaEl.style.display = folha.ocultarMeta ? "none" : "block";
				}
			});
		}

		// Toggle "Ocultar meta"
	}

	if (window.Cancioneiro.painelPronto) {
		configurarTogglesPainel();
	} else {
		document.addEventListener("painel-pronto", configurarTogglesPainel);
	}
}

// -----------------------------------------------------------------------------
// SECÇÃO 6: Inicialização
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

	if (estadoFolha.folha.tipo === "partilhada") {
		const folhasPartilhadas = JSON.parse(localStorage.getItem(Cancioneiro.folhas.KEY_PARTILHADAS) || "[]");
		if (!folhasPartilhadas.includes(folhaId)) {
			folhasPartilhadas.push(folhaId);
		}
		localStorage.setItem(Cancioneiro.folhas.KEY_PARTILHADAS, JSON.stringify(folhasPartilhadas));
	}

	// 🆕 Carregar preferências locais
	const prefsLocais = carregarPrefsLocais(folhaId);
	aplicarPrefsLocais(estadoFolha.folha, prefsLocais);

	estadoFolha.indice = await carregarIndice();

	inicializarCabecalho();
	await renderizarFolha();

	document.addEventListener("preferencia-alterada", () => renderizarFolha());

	if (window.gtag) {
		gtag('event', 'page_view', {
			page_path: `/folha.html?id=${folhaId}`,
			page_title: document.title,
			folha_id: folhaId,
			folha_titulo: estadoFolha.folha.titulo
		});
	}
}

init();