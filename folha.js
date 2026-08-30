// folha.js — Lógica da página de visualização de uma folha de cânticos (modo apresentação)

async function renderFolha(folhaId) {
	const app = document.getElementById("app");
	if (!app) return;
	
	app.innerHTML = `
		<header class="header-grid">
		<div class="header-info">
			<button id="btn-voltar" class="btn-transparente btn-voltar">← Voltar</button>
			<div id="folha-titulo-linha">
			<h1 id="folha-titulo"></h1>
			</div>
			<div id="folha-meta"></div>
		</div>
	
		<div class="btn-header btn-normal">
			<button id="btn-definicoes" title="Definições">⚙</button>
			<button id="btn-exportar-folha" title="Exportar folha">⤓</button>
			<button id="btn-partilhar-folha" title="Partilhar folha">➦</button>
			<button id="btn-editar-folha" title="Editar folha">✎</button>
			<nav-comp id="nav-comp" class="VerPaginas oculto"></nav-comp>
		</div>
		</header>
	
		<main id="folha-conteudo"></main>
	`;
	
	await initFolha(folhaId);
}

async function initFolha(folhaId) {
	let folhaCarregada = null;
	const estadoFolha = obterEstadoFolha();

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

	inicializarCabecalhoFolha();
	await renderizarFolha();

	document.addEventListener("preferencia-alterada", () => renderizarFolha());

	// Botão voltar
	document.getElementById("btn-voltar").addEventListener("click", () => {
		navigate("/home");
	});

	if (window.gtag) {
		gtag('event', 'page_view', {
			page_path: `/folha?id=${folhaId}`,
			page_title: document.title,
			folha_id: folhaId,
			folha_titulo: estadoFolha.folha.titulo
		});
	}
}

// -----------------------------------------------------------------------------
// SECÇÃO 1: Estado da página
// -----------------------------------------------------------------------------

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


// -----------------------------------------------------------------------------
// SECÇÃO 3: Renderização da folha (modo apresentação)
// -----------------------------------------------------------------------------

async function renderizarFolha() {
	const estadoFolha = obterEstadoFolha();
	const conteudo = document.getElementById("folha-conteudo");
	const notacao = Cancioneiro.preferencias.obter("notacao");
	const mostrarAcordes = Cancioneiro.preferencias.obter("mostrarAcordes");
	conteudo.innerHTML = "";

	const folha = estadoFolha.folha;
	const verPaginas = folha.verPaginas === true;

	const navComp = document.getElementById("nav-comp .VerPaginas");
	if (navComp) {
		if (verPaginas) {
			navComp.classList.remove("oculto");
		}
		else {
			navComp.classList.add("oculto");
		}
	}

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
	atualizarNavegacao(momentosFiltrados);
}


// -----------------------------------------------------------------------------
// SECÇÃO 4: Eventos (transposição e navegação)
// -----------------------------------------------------------------------------

function obterEntrada(momentoId, canticoId) {
	const estadoFolha = obterEstadoFolha();
	const momento = estadoFolha.folha.momentos.find(m => m.id === momentoId);
	return momento?.canticos.find(c => c.canticoId === canticoId) || null;
}

function ligarEventos(momentosFiltrados) {
	const nav = document.getElementById("nav-comp");
	if (!nav) return;

	const estadoFolha = obterEstadoFolha();
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
	const btnAnterior = nav?.querySelector("button#btn-anterior");
	const btnSeguinte = nav?.querySelector("button#btn-seguinte");

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
	const estadoFolha = obterEstadoFolha();
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
	const estadoFolha = obterEstadoFolha();
	const folha = estadoFolha.folha;

	// Se for folha privada, vai direto para o editor
	if (folha.tipo === "privada") {
		navigate("/editor-folha", { id: folha.id });
		return;
	}

	// Se for partilhada ou pública, pede autenticação
	const resultado = await window.Cancioneiro.dbApi.authFolha(folha.tipo, folha.id);

	if (resultado.sucesso) {
		navigate("/editor-folha", { id: folha.id });
	} else {
		alert(resultado.erro || "Não foi possível autenticar.");
	}
}

// -----------------------------------------------------------------------------
// SECÇÃO 5B: Partilha de folhas
// -----------------------------------------------------------------------------
async function abrirOverlayPartilha() {
	const estadoFolha = obterEstadoFolha();
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
	const estadoFolha = obterEstadoFolha();
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
	const baseUrl = window.location.origin + window.location.pathname.replace("folha", "");
	return `${baseUrl}folha?id=${folhaId}`;
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
	const estadoFolha = obterEstadoFolha();
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
	const estadoFolha = obterEstadoFolha();
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
	navigate("/editor-folha", { id: resultado.id });
}

// -----------------------------------------------------------------------------
// SECÇÃO 5C: Exportação de folhas
// -----------------------------------------------------------------------------
function nomeArquivoSeguro(nome) {
	return (nome || "folha")
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
		.replace(/\s+/g, "-")
		.toLowerCase();
}

function dataCabecalhoExportacao(folha) {
	const base = folha.data ? new Date(folha.data + "T00:00:00") : new Date();
	return base.toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function carregarScript(url, checkFn) {
	return new Promise((resolve, reject) => {
		if (checkFn()) return resolve();

		const s = document.createElement("script");
		s.src = url;
		s.async = true;
		s.onload = () => checkFn() ? resolve() : reject(new Error(`Dependência inválida: ${url}`));
		s.onerror = () => reject(new Error(`Falha ao carregar script: ${url}`));
		document.head.appendChild(s);
	});
}

async function garantirBibliotecasExportacao(formato) {
	await carregarScript(
		"https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js",
		() => typeof window.html2canvas === "function"
	);

	if (formato === "pdf") {
		await carregarScript(
			"https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
			() => !!(window.jspdf && window.jspdf.jsPDF)
		);
	} else {
		await carregarScript(
			"https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js",
			() => typeof window.JSZip !== "undefined"
		);
	}
}

function ehIntroducaoSecao(seccao) {
    const label = (seccao?.label || "").trim().toLowerCase();
    return label.includes("introducao") || label.includes("introdução") || label.includes("intro");
}

function renderizarSecoesParaExport(seccoes, mostrarAcordes, notacao, semitons, incluirTitulos) {
    const container = document.createElement("div");
    container.className = "cantico-letra";

    for (const seccao of seccoes) {
        const div = document.createElement("div");
        div.className = `seccao seccao-${seccao.type}`;

        if (incluirTitulos && seccao.label) {
            div.innerHTML += `<div class="seccao-label">${seccao.label}</div>`;
        }

        for (const linha of seccao.lines) {
            if (linha === null) {
                div.innerHTML += '<div class="linha-vazia"></div>';
            } else {
                div.innerHTML += renderizarLinha(linha, mostrarAcordes, notacao, semitons);
            }
        }

        container.appendChild(div);
    }

    return container.outerHTML;
}

function renderizarCanticoParaExport(dados, semitons = 0, seccoesPermitidas = null, opcoes = {}) {
    const notacao = Cancioneiro.preferencias.obter("notacao");
    const mostrarAcordes = opcoes.incluirAcordes === true;
    const incluirTitulos = opcoes.incluirTitulosSeccao === true;

    const sections = (dados.sections || []).filter((seccao) => {
        if (!seccoesPermitidas) return true;
        const labelSafe = seccao.label || "(sem etiqueta)";
        return seccoesPermitidas.includes(labelSafe);
    });

    const introducao = sections.filter(ehIntroducaoSecao);
    const estrofes = sections.filter(seccao => !ehIntroducaoSecao(seccao));

    if (estrofes.length >= 3) {
        const linhasTotal = estrofes.reduce((acc, seccao) => acc + (seccao.lines?.length || 0), 0);

        if (linhasTotal >= 12) {
            const iniciais = estrofes.slice(0, 2);
            const restantes = estrofes.slice(2);

            const meio = Math.ceil(restantes.length / 2);
            const esquerda = restantes.slice(0, meio);
            const direita = restantes.slice(meio);

            const htmlIntroducao = introducao.length
                ? renderizarSecoesParaExport(introducao, mostrarAcordes, notacao, semitons, incluirTitulos)
                : "";
            const htmlIniciais = renderizarSecoesParaExport(iniciais, mostrarAcordes, notacao, semitons, incluirTitulos);
            const htmlEsquerda = renderizarSecoesParaExport(esquerda, mostrarAcordes, notacao, semitons, incluirTitulos);
            const htmlDireita = renderizarSecoesParaExport(direita, mostrarAcordes, notacao, semitons, incluirTitulos);

            return `
                ${htmlIntroducao ? `<div class="cantico-introducao">${htmlIntroducao}</div>` : ""}
                <div class="cantico-primeiras">${htmlIniciais}</div>
                <div class="cantico-duas-colunas">
                    <div class="cantico-coluna">${htmlEsquerda}</div>
                    <div class="cantico-coluna">${htmlDireita}</div>
                </div>
            `;
        }
    }

    return renderizarSecoesParaExport(sections, mostrarAcordes, notacao, semitons, incluirTitulos);
}

function criarPaginaExportacao(item, index, total, opcoes, tituloFolha, dataCabecalho) {
	const { momento, entrada, canticoData } = item;
	const { meta, dados } = canticoData;
	const notacao = Cancioneiro.preferencias.obter("notacao");

	const semitons = entrada.tom || 0;
	const tomOriginal = dados.meta.key || meta.tom || "";
	const tomAtual = transporAcorde(tomOriginal, semitons);

	const tomOriginalTxt = notacao === "latino" ? Cancioneiro.parser.converterAcorde(tomOriginal, "latino") : tomOriginal;
	const tomAtualTxt = notacao === "latino" ? Cancioneiro.parser.converterAcorde(tomAtual, "latino") : tomAtual;
	const tomLabel = semitons !== 0 ? `Tom: ${tomOriginalTxt} → ${tomAtualTxt}` : `Tom: ${tomOriginalTxt}`;

	const tituloCantico = dados.meta.title || meta.titulo || "Sem título";

	const page = document.createElement("div");
	page.className = "export-page";
	page.style.cssText = `
		width: 595px;
		min-height: 842px;
		height: 842px;
		box-sizing: border-box;
		margin: 0;
		padding: 42px 40px 30px;
		background: #fff;
		color: #000;
		font-family: Arial, sans-serif;
		font-size: 16px;
		line-height: 1.45;
		text-align: left;
		display: block;
		position: relative;
		overflow: hidden;
	`;
	page.innerHTML = `
		<div class="export-cabecalho">
			<div>${tituloFolha || "Folha de Cânticos"}</div>
			<div>${dataCabecalho}</div>
		</div>

		${opcoes.incluirNomeMomento ? `<div class="export-momento">${momento.label}</div>` : ""}
		${opcoes.incluirNomeCantico ? `<div class="export-titulo">${tituloCantico}</div>` : ""}
		${opcoes.incluirTom ? `<div class="export-meta">${tomLabel}</div>` : ""}

		<div class="export-corpo">
			${renderizarCanticoParaExport(dados, semitons, entrada.seccoes, opcoes)}
		</div>

		<div class="export-rodape">${index + 1}/${total}</div>
	`;

	ajustarEscalaCorpoExportacao(page);

	return page;
}

function ajustarEscalaCorpoExportacao(page) {
    const corpo = page.querySelector(".export-corpo");
    if (!corpo) return;

    const blocos = corpo.querySelectorAll(".cantico-letra, .cantico-introducao, .cantico-primeiras, .cantico-duas-colunas");
    if (!blocos.length) return;

    const pageStyle = getComputedStyle(page);
    const alturaPagina = page.clientHeight || 842;
    const paddingTop = parseFloat(pageStyle.paddingTop || "0");
    const paddingBottom = parseFloat(pageStyle.paddingBottom || "0");

    const cabecalho = page.querySelector(".export-cabecalho");
    const momento = page.querySelector(".export-momento");
    const titulo = page.querySelector(".export-titulo");
    const meta = page.querySelector(".export-meta");
    const rodape = page.querySelector(".export-rodape");

    const alturaCabecalho = cabecalho ? cabecalho.getBoundingClientRect().height : 0;
    const alturaMomento = momento ? momento.getBoundingClientRect().height : 0;
    const alturaTitulo = titulo ? titulo.getBoundingClientRect().height : 0;
    const alturaMeta = meta ? meta.getBoundingClientRect().height : 0;
    const alturaRodape = rodape ? rodape.getBoundingClientRect().height : 0;

    const alturaConsumida =
        paddingTop +
        paddingBottom +
        alturaCabecalho +
        alturaMomento +
        alturaTitulo +
        alturaMeta +
        alturaRodape +
        18;

    const alturaDisponivel = Math.max(120, alturaPagina - alturaConsumida);
    const alturaReal = corpo.scrollHeight || corpo.offsetHeight || 0;

    if (!alturaReal || alturaReal <= alturaDisponivel) {
        blocos.forEach((bloco) => {
            bloco.style.fontSize = "";
            bloco.style.lineHeight = "";
        });
        corpo.style.overflow = "visible";
        corpo.style.height = "";
        return;
    }

    const escala = Math.max(0.7, Math.min(1, alturaDisponivel / alturaReal));

    blocos.forEach((bloco) => {
        const fontBase = parseFloat(getComputedStyle(bloco).fontSize || "16");
        const lineBase = parseFloat(getComputedStyle(bloco).lineHeight || "23");

        bloco.style.fontSize = `${fontBase * escala}px`;
        bloco.style.lineHeight = `${lineBase * escala}px`;
    });

    corpo.style.overflow = "hidden";
    corpo.style.height = `${Math.ceil(alturaReal * escala)}px`;
}

function descarregarBlob(blob, nomeFicheiro) {
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = nomeFicheiro;
	document.body.appendChild(a);
	a.click();
	a.remove();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function obterOpcoesCanvasExport() {
	return {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
        onclone: (doc) => {
            const style = doc.createElement("style");
            style.textContent = `
                :root {
                    --cor-primaria: #000 !important;
                    --cor-secundaria: #f8f8ff !important;
                    --cor-destaque: #ff6400 !important;
                    --cor-fundo: #fff !important;
                    --cor-fundo-secundario: #fff !important;
                    --cor-hover: #eee !important;
                    --cor-texto: #000 !important;
                    --cor-texto-secundario: #555 !important;
                    --cor-texto-terciario: #777 !important;
                    --cor-contorno: #cfcfcf !important;
                    --cor-contorno-secundario: #d9d9d9 !important;
                }

                #export-root,
                #export-root * {
                    text-shadow: none !important;
                    box-shadow: none !important;
                }

                #export-root .export-page {
                    width: 595px !important;
                    height: 842px !important;
                    box-sizing: border-box !important;
                    padding: 42px 40px 30px !important;
                    margin: 0 !important;
                    text-align: left !important;
                    overflow: hidden !important;
                }

                #export-root .export-corpo {
                    position: relative !important;
                    display: block !important;
                    width: 100% !important;
                    overflow: hidden !important;
                }

                #export-root .cantico-primeiras,
                #export-root .cantico-duas-colunas,
                #export-root .cantico-coluna,
                #export-root .cantico-letra {
                    width: 100% !important;
                    text-align: left !important;
                }

                #export-root .cantico-duas-colunas {
                    display: grid !important;
                    grid-template-columns: 1fr 1fr !important;
                    column-gap: 24px !important;
                    align-items: start !important;
                }

                #export-root .cantico-coluna {
                    display: block !important;
                }

                #export-root .acorde {
                    color: #ff6400 !important;
                }
            `;
            doc.head.appendChild(style);
        }
    };
}

async function exportarPaginasPDF(paginas, nomeBase) {
	const { jsPDF } = window.jspdf;
	const pdf = new jsPDF({ orientation: "p", unit: "pt", format: "a4" });
	const pageW = pdf.internal.pageSize.getWidth();
	const pageH = pdf.internal.pageSize.getHeight();

	for (let i = 0; i < paginas.length; i++) {
		if (i > 0) pdf.addPage();

		const canvas = await window.html2canvas(paginas[i], obterOpcoesCanvasExport());
		const img = canvas.toDataURL("image/png");

		const ratio = Math.min(pageW / canvas.width, pageH / canvas.height);
		const w = canvas.width * ratio;
		const h = canvas.height * ratio;
		const x = (pageW - w) / 2;
		const y = 0;

		pdf.addImage(img, "PNG", x, y, w, h);
	}

	pdf.save(`${nomeArquivoSeguro(nomeBase)}.pdf`);
}

async function exportarPaginasPNGZip(paginas, itens, nomeBase) {
	const zip = new window.JSZip();

	for (let i = 0; i < paginas.length; i++) {
		const canvas = await window.html2canvas(paginas[i], obterOpcoesCanvasExport());
		const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
		const titulo = (itens[i]?.canticoData?.dados?.meta?.title || itens[i]?.canticoData?.meta?.titulo || `cantico-${i + 1}`);
		zip.file(`${String(i + 1).padStart(2, "0")}-${nomeArquivoSeguro(titulo)}.png`, blob);
	}

	const zipBlob = await zip.generateAsync({ type: "blob" });
	descarregarBlob(zipBlob, `${nomeArquivoSeguro(nomeBase)}.zip`);
}

async function exportarFolha(formato, opcoes) {
	const estadoFolha = obterEstadoFolha();
	const folha = estadoFolha.folha;
	const momentosFiltrados = folha.momentos.filter(m => m.canticos.length > 0);

	const itens = [];
	for (const momento of momentosFiltrados) {
		for (const entrada of momento.canticos) {
			const canticoData = await carregarCantico(entrada.canticoId);
			if (canticoData) itens.push({ momento, entrada, canticoData });
		}
	}

	if (itens.length === 0) {
		alert("Não há cânticos para exportar.");
		return;
	}

	await garantirBibliotecasExportacao(formato);

	const root = document.createElement("div");
	root.id = "export-root";
	root.style.position = "fixed";
	root.style.left = "-10000px";
	root.style.top = "0";
	root.style.zIndex = "-1";
	root.style.background = "#fff";
	document.body.appendChild(root);

	try {
		const dataCab = dataCabecalhoExportacao(folha);
		const paginas = itens.map((item, i) =>
			criarPaginaExportacao(item, i, itens.length, opcoes, folha.titulo, dataCab)
		);

		paginas.forEach(p => root.appendChild(p));

		await new Promise(r => requestAnimationFrame(r));
		paginas.forEach(p => ajustarEscalaCorpoExportacao(p));

		await new Promise(r => setTimeout(r, 30));

		if (formato === "pdf") {
			await exportarPaginasPDF(paginas, folha.titulo || "folha");
		} else {
			await exportarPaginasPNGZip(paginas, itens, folha.titulo || "folha");
		}
	} finally {
		root.remove();
	}
}

function fecharOverlayExportacao() {
	document.getElementById("overlay-exportacao")?.classList.remove("overlay-visivel");
	document.getElementById("painel-exportacao")?.classList.remove("painel-aberto");
	document.getElementById("painel-exportacao")?.classList.add("painel-fechado");
}

function obterOpcoesExportacaoPainel() {
	const painel = document.getElementById("painel-exportacao");
	return {
		formato: painel?.dataset.formato || "pdf",
		incluirNomeMomento: document.getElementById("exp-momento")?.checked === true,
		incluirNomeCantico: document.getElementById("exp-cantico")?.checked === true,
		incluirTom: document.getElementById("exp-tom")?.checked === true,
		incluirTitulosSeccao: document.getElementById("exp-seccoes")?.checked === true,
		incluirAcordes: document.getElementById("exp-acordes")?.checked === true
	};
}

function ligarEventosExportacao() {
	document.getElementById("btn-fechar-exportacao")?.addEventListener("click", fecharOverlayExportacao);

	document.querySelectorAll(".btn-formato-export").forEach(btn => {
		btn.addEventListener("click", () => {
			const painel = document.getElementById("painel-exportacao");
			painel.dataset.formato = btn.dataset.formato;
			document.querySelectorAll(".btn-formato-export").forEach(b => b.classList.remove("ativo"));
			btn.classList.add("ativo");
		});
	});

	document.getElementById("btn-exportar-confirmar")?.addEventListener("click", async () => {
		const btn = document.getElementById("btn-exportar-confirmar");
		const status = document.getElementById("export-status");
		const opcoes = obterOpcoesExportacaoPainel();

		try {
			btn.disabled = true;
			if (status) status.textContent = "A preparar exportação...";
			await exportarFolha(opcoes.formato, opcoes);
			if (status) status.textContent = "Exportação concluída.";
			fecharOverlayExportacao();
		} catch (e) {
			console.error("Erro na exportação:", e);
			if (status) status.textContent = "Erro na exportação.";
			alert("Não foi possível exportar a folha.");
		} finally {
			btn.disabled = false;
		}
	});
}

function abrirOverlayExportacao() {
	let overlay = document.getElementById("overlay-exportacao");
	if (!overlay) {
		overlay = document.createElement("div");
		overlay.id = "overlay-exportacao";
		overlay.className = "overlay overlay-visivel";
		document.body.appendChild(overlay);
		overlay.addEventListener("click", (e) => {
			if (e.target === overlay) fecharOverlayExportacao();
		});
	} else {
		overlay.classList.add("overlay-visivel");
	}

	let painel = document.getElementById("painel-exportacao");
	if (!painel) {
		painel = document.createElement("div");
		painel.id = "painel-exportacao";
		painel.className = "painel painel-aberto";
		painel.dataset.formato = "pdf";
		document.body.appendChild(painel);
	} else {
		painel.classList.add("painel-aberto");
		painel.classList.remove("painel-fechado");
		painel.dataset.formato = painel.dataset.formato || "pdf";
	}

	const formato = painel.dataset.formato;
	painel.innerHTML = `
		<div class="painel-conteudo">
			<div class="painel-cabecalho">
				<h2>Exportar Folha</h2>
				<button id="btn-fechar-exportacao" class="btn-fechar">✕</button>
			</div>

			<div class="painel-corpo">
				<div class="definicao-grupo">
					<label>Formato</label>
					<div class="opcoes-toggle">
						<button type="button" class="opcao-toggle btn-formato-export ${formato === "pdf" ? "ativo" : ""}" data-formato="pdf">PDF</button>
						<button type="button" class="opcao-toggle btn-formato-export ${formato === "png" ? "ativo" : ""}" data-formato="png">PNG (.zip)</button>
					</div>
				</div>

				<div class="definicao-grupo">
					<label>Incluir</label>
					<div class="export-opcoes">
						<label class="export-opcao"><input type="checkbox" id="exp-momento" checked> Nome do momento</label>
						<label class="export-opcao"><input type="checkbox" id="exp-cantico" checked> Nome do cântico</label>
						<label class="export-opcao"><input type="checkbox" id="exp-tom" checked> Tom original / selecionado</label>
						<label class="export-opcao"><input type="checkbox" id="exp-seccoes" checked> Títulos de estrofes/refrão</label>
						<label class="export-opcao"><input type="checkbox" id="exp-acordes" checked> Acordes</label>
					</div>
				</div>

				<div id="export-status" class="export-status"></div>
				<button id="btn-exportar-confirmar" class="btn-primario">Exportar</button>
			</div>
		</div>
	`;

	ligarEventosExportacao();
}

// -----------------------------------------------------------------------------
// SECÇÃO 6: Cabeçalho (visualização apenas)
// -----------------------------------------------------------------------------

function inicializarCabecalhoFolha() {
	const estadoFolha = obterEstadoFolha();
	const folha = estadoFolha.folha;
	const tituloEl = document.getElementById("folha-titulo");

	tituloEl.textContent = folha.titulo;
	document.title = folha.titulo;

	const dataFormatada = folha.data
		? new Date(folha.data + "T00:00:00").toLocaleDateString("pt-PT", {
			day: "numeric", month: "long", year: "numeric" })
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
		
	// Botão de exportar
	const btnExportar = document.getElementById("btn-exportar-folha");
	if (btnExportar) {
		btnExportar.addEventListener("click", abrirOverlayExportacao);
	}
}