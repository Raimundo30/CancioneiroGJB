function criarPaginaExportacao(item, i, total, opcoes, tituloFolha, dataCabecalho) {
    const canticoData = item?.canticoData;
    const entrada = item?.entrada || {};
    const dados = canticoData?.dados || window.Cancioneiro?.parser?.parseChordPro(canticoData?.conteudoChordPro || "");
    const meta = canticoData?.meta || {};
    const semitons = Number(entrada.tom || 0);

    const titulo = dados?.meta?.title || meta.titulo || "Sem título";
    const subtitulo = dados?.meta?.subtitle || meta.subtitulo || "";
    const autor = dados?.meta?.author || meta.autor || "";
    const tomOriginal = dados?.meta?.key || meta.tom || "";
    const tomFinal = tomOriginal ? transporAcorde(tomOriginal, semitons) : "";

    const pagina = document.createElement("article");
    pagina.className = "export-page";
    pagina.classList.toggle("sem-acordes", opcoes?.incluirAcordes === false);
    pagina.classList.toggle("sem-seccoes", opcoes?.incluirTitulosSeccao === false);

    pagina.style.cssText = `
        position: relative;
        width: 794px;
        height: 1123px;
        background: #ffffff;
        color: #111111;
        border: 1px solid #d9d9d9;
        padding: 48px 52px 36px;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        gap: 0;
        font-family: Georgia, "Times New Roman", serif;
        overflow: hidden;
        box-shadow: none;
    `;

    const html = `
        <style>
            .export-page * { box-sizing: border-box; }

            .export-page {
                --exp-texto: #111111;
                --exp-texto-sec: #444444;
                --exp-texto-ter: #666666;
                --exp-borda: #d9d9d9;
                --exp-acorde: #ff6400;
                --exp-fundo: #ffffff;
            }

            .export-page {
                color: var(--exp-texto);
                background: var(--exp-fundo);
            }

            .export-cabecalho {
                flex-shrink: 0;
                padding-bottom: 14px;
                border-bottom: 1px solid var(--exp-borda);
                display: flex;
                flex-direction: column;
                gap: 8px;
            }

            .export-folha-titulo {
                font-size: 12px;
                line-height: 1.2;
                letter-spacing: 0.08em;
                text-transform: uppercase;
                color: var(--exp-texto-ter);
            }

            .export-cantico-titulo {
                font-size: 30px;
                line-height: 1.15;
                font-weight: 700;
                margin: 0;
                color: var(--exp-texto);
            }

            .export-cantico-subtitulo {
                font-size: 18px;
                line-height: 1.2;
                color: var(--exp-texto-sec);
                margin: 0;
            }

            .export-meta {
                font-size: 14px;
                line-height: 1.4;
                color: var(--exp-texto-sec);
                display: flex;
                flex-wrap: wrap;
                gap: 6px;
            }

            .export-corpo {
                flex: 1 1 auto;
                min-height: 0;
                overflow: hidden;
                display: flex;
                flex-direction: column;
                justify-content: flex-start;
                margin-top: 16px;
                margin-bottom: 12px;
                font-size: var(--export-body-size, 17px);
                line-height: 1.15;
                color: var(--exp-texto);
            }

            .export-corpo .cantico-letra,
            .export-corpo .seccao,
            .export-corpo .linha-letra,
            .export-corpo .token,
            .export-corpo .silaba,
            .export-corpo .acorde,
            .export-corpo .seccao-label {
                font-family: inherit;
            }

            .export-corpo .seccao {
                margin-bottom: 18px;
            }

            .export-corpo .seccao-label {
                font-size: var(--export-label-size, 12px);
                line-height: 1.2;
                text-transform: uppercase;
                letter-spacing: 0.08em;
                color: var(--exp-texto-ter);
                margin-bottom: 8px;
                font-weight: 700;
            }

            .export-corpo .linha-letra {
                display: flex;
                flex-wrap: nowrap;
                width: 100%;
                max-width: 100%;
                align-items: flex-end;
                min-height: 1.2em;
                margin-bottom: 2px;
            }

            .export-corpo .linha-vazia {
                height: 0.6em;
            }

            .export-corpo .linha-comentario {
                font-size: var(--export-body-size, 17px);
                color: var(--exp-texto-ter);
                font-style: italic;
                margin-bottom: 8px;
            }

            .export-corpo .token {
                display: inline-flex;
                flex-direction: column;
                align-items: flex-start;
                justify-content: flex-end;
                margin-right: 0.12em;
            }

            .export-corpo .acorde {
                font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
                font-size: var(--export-acorde-size, 15px);
                line-height: 1.2;
                color: var(--exp-acorde);
                font-weight: 700;
                white-space: pre;
                min-width: 1ch;
            }

            .export-corpo .silaba {
                font-size: var(--export-body-size, 17px);
                line-height: 1.15;
                white-space: pre;
                color: var(--exp-texto);
            }

            .export-corpo .acorde-vazio {
                visibility: hidden;
            }

            .export-page.sem-acordes .acorde,
            .export-page.sem-acordes .acorde-vazio {
                display: none !important;
            }

            .export-page.sem-seccoes .seccao-label {
                display: none !important;
            }

            .export-rodape {
                flex-shrink: 0;
                padding-top: 12px;
                border-top: 1px solid var(--exp-borda);
                font-size: 11px;
                color: var(--exp-texto-ter);
                line-height: 1.2;
                text-align: right;
                letter-spacing: 0.04em;
                text-transform: uppercase;
            }
        </style>

        <div class="export-cabecalho">
            <div class="export-folha-titulo">${tituloFolha || "Cancioneiro"}</div>
            ${opcoes?.incluirNomeCantico !== false ? `<h1 class="export-cantico-titulo">${titulo}</h1>` : ""}
            ${subtitulo ? `<h2 class="export-cantico-subtitulo">(${subtitulo})</h2>` : ""}
            <div class="export-meta">
                ${autor ? `<span>${autor}</span>` : ""}
                ${opcoes?.incluirTom !== false && tomFinal ? `<span>Tom: ${tomFinal}</span>` : ""}
                ${entrada?.notas ? `<span>${entrada.notas}</span>` : ""}
            </div>
        </div>

        <div class="export-corpo">
            ${renderizarCantico(dados, semitons, entrada?.seccoes || null)}
        </div>

        <div class="export-rodape">
            ${dataCabecalho || ""} · página ${i + 1}/${total}
        </div>
    `;

    pagina.innerHTML = html;

    if (opcoes?.incluirNomeMomento !== false && item?.momento?.label) {
        const cabecalho = pagina.querySelector(".export-cabecalho");
        const momento = document.createElement("div");
        momento.className = "export-folha-titulo";
        momento.textContent = item.momento.label;
        cabecalho.insertBefore(momento, cabecalho.firstChild);
    }

    return pagina;
}

function ajustarEscalaCorpoExportacao(pagina) {
    if (!pagina) return;

    const corpo = pagina.querySelector(".export-corpo");
    const cabecalho = pagina.querySelector(".export-cabecalho");
    const rodape = pagina.querySelector(".export-rodape");
    if (!corpo || !cabecalho || !rodape) return;

    // Altura real disponível para o corpo depois de cabeçalho + rodapé + padding da página
    const alturaPagina = pagina.clientHeight || 1123;
    const alturaDisponivel = Math.max(
        120,
        alturaPagina - cabecalho.offsetHeight - rodape.offsetHeight - 70
    );

    corpo.style.height = `${alturaDisponivel}px`;
    corpo.style.maxHeight = `${alturaDisponivel}px`;

    let tamanho = 25;

    for (let i = 0; i < 80; i++) {
        corpo.style.setProperty("--export-body-size", `${tamanho}px`);
        corpo.style.setProperty("--export-acorde-size", `${Math.max(11, tamanho * 0.85)}px`);
        corpo.style.setProperty("--export-label-size", `${Math.max(9, tamanho * 0.65)}px`);

        const excede = corpo.scrollHeight > corpo.clientHeight + 1;
        if (!excede || tamanho <= 8) break;

        tamanho = Math.max(8, tamanho - 0.25);
    }

    const titulo = pagina.querySelector(".export-cantico-titulo");
    if (titulo) {
        const tamanhoTitulo = Math.min(30, Math.max(22, 30 - ((25 - tamanho) * 0.75)));
        titulo.style.fontSize = `${tamanhoTitulo}px`;
        titulo.style.lineHeight = "1.15";
    }
}

function obterOpcoesCanvasExport() {
    return {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
        allowTaint: true,
        logging: false
    };
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

    console.groupCollapsed("[export-debug] exportarFolha inicio");
    console.log("folha:", folha.titulo);
    console.log("momentos:", momentosFiltrados.length);
    console.groupEnd();

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

        console.log("[export-debug] paginas criadas:", paginas.length);

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