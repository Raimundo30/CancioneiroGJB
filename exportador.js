// ============================================================================
// 1. CONFIGURAÇÕES E ESTILOS
// ============================================================================
const ExportConfig = {
    layout: { fontIdeal: 25, fontMin: 8, gapColunas: 32 },
    page: { width: 794, height: 1123, paddingBase: 120 }, // H-offset (cabeçalho/rodapé + padding)
    
    obterCSS: () => `
        <style>
            .export-page * { box-sizing: border-box; }
            .export-page {
                --exp-texto: #111111; --exp-texto-sec: #444444; --exp-texto-ter: #666666;
                --exp-borda: #d9d9d9; --exp-acorde: #ff6400; --exp-fundo: #ffffff;
                position: relative; width: ${ExportConfig.page.width}px; height: ${ExportConfig.page.height}px;
                background: var(--exp-fundo); color: var(--exp-texto);
                border: 1px solid var(--exp-borda); padding: 48px 52px 36px;
                display: flex; flex-direction: column; font-family: Georgia, serif; overflow: hidden;
            }
            .export-cabecalho { flex-shrink: 0; padding-bottom: 14px; padding-right: 80px; border-bottom: 1px solid var(--exp-borda); display: flex; flex-direction: column; gap: 8px; }
            .export-folha-titulo { font-size: 15px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--exp-texto-ter); }
            .export-momento-titulo { font-size: 20px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--exp-texto); }
            .export-cantico-titulo { font-size: 20px; line-height: 1.15; font-weight: 700; margin: 0;  color: var(--exp-texto-sec);}
            .export-cantico-subtitulo { font-size: 18px; color: var(--exp-texto-sec); margin: 0; }
            .export-meta { font-size: 12px; color: var(--exp-texto-ter); display: flex; flex-wrap: wrap; gap: 6px; }
            
            .export-qrcode { position: absolute; top: 48px; right: 52px; width: 65px; height: 65px; background: #fff; }

            .export-corpo {
                flex: 1 1 auto; margin: 16px 0 12px; overflow: hidden; display: flex; flex-direction: column;
                min-height: 0; justify-content: flex-start;
                font-size: var(--export-body-size, 17px); line-height: 1.15;
            }
            .export-corpo .seccao { margin-bottom: calc(var(--export-body-size, 17px) * 2.0); }
            .export-corpo .seccao-label { font-size: var(--export-label-size, 12px); text-transform: uppercase; font-weight: 700; color: var(--exp-texto-ter); margin-bottom: 0.32em; }
            .export-corpo .linha-letra { display: flex; align-items: flex-end; min-height: 1.2em; margin-bottom: 0.08em; }
            .export-corpo .acorde { font-family: monospace; font-size: var(--export-acorde-size, 15px); color: var(--exp-acorde); font-weight: 700; white-space: pre; }
            .export-corpo .silaba { white-space: pre; }
            
            .export-page.sem-acordes .acorde { display: none !important; }
            .export-page.sem-seccoes .seccao-label { display: none !important; }
            
            .export-corpo.medindo-natural { width: max-content; height: auto; max-width: none; max-height: none; overflow: visible; }
            .export-corpo.medindo-natural .linha-letra { width: max-content; max-width: none; }
            .export-coluna { display: flex; flex-direction: column; overflow: hidden; }
            
            .export-rodape { flex-shrink: 0; padding-top: 12px; border-top: 1px solid var(--exp-borda); font-size: 11px; color: var(--exp-texto-ter); text-align: right; text-transform: uppercase; }
        </style>
    `
};

// ============================================================================
// MÓDULO QR CODE
// ============================================================================
const ExportQR = {
    obterBase64: async (folhaId) => {
        if (!folhaId) return null;
        
        const base = `${window.location.origin}${window.location.pathname}`.replace(/\/$/, "");
        const url = `${base}/#/folha?id=${encodeURIComponent(String(folhaId))}`;

        const qrcodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(url)}`;
        
        try {
            const resposta = await fetch(qrcodeUrl);
            const blob = await resposta.blob();
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.readAsDataURL(blob);
            });
        } catch (e) {
            console.error("Erro ao carregar o QR Code:", e);
            return null;
        }
    }
};

// ============================================================================
// 2. CONSTRUTOR DE PÁGINAS (DOM)
// ============================================================================
const ExportDOM = {
    criarPagina: (item, i, total, opcoes, tituloFolha, dataCabecalho) => {
        const { canticoData, entrada = {}, momento } = item || {};
        const dados = canticoData?.dados || window.Cancioneiro?.parser?.parseChordPro(canticoData?.conteudoChordPro || "");
        const meta = canticoData?.meta || {};
        
        const semitons = Number(entrada.tom || 0);
        const tomOriginal = dados?.meta?.key || meta.tom || "";
        const tomFinal = tomOriginal ? transporAcorde(tomOriginal, semitons) : "";
        const titulo = dados?.meta?.title || meta.titulo || "Sem título";
        const subtitulo = dados?.meta?.subtitle || meta.subtitulo || "";
        const autor = dados?.meta?.author || meta.autor || "";

        let htmlTituloCantico = "";
        if (subtitulo) {
            htmlTituloCantico = `<h1 class="export-cantico-titulo">${titulo} (${subtitulo})</h1>`;
        } else {
            htmlTituloCantico = `<h1 class="export-cantico-titulo">${titulo}</h1>`;
        }

        const pagina = document.createElement("article");
        pagina.className = `export-page ${opcoes.incluirAcordes === false ? 'sem-acordes' : ''} ${opcoes.incluirTitulosSeccao === false ? 'sem-seccoes' : ''}`;
        
        pagina.innerHTML = `
            ${ExportConfig.obterCSS()}
            <div class="export-cabecalho">
                <div class="export-folha-titulo">${tituloFolha || "Cancioneiro"}</div>
                ${opcoes.incluirNomeMomento !== false && momento?.label ? `<div class="export-momento-titulo">${momento.label}</div>` : ""}
                ${opcoes.incluirNomeCantico !== false ? htmlTituloCantico : ""}
                <div class="export-meta">
                    ${autor ? `<span>${autor}</span>` : ""}
                    ${opcoes.incluirTom !== false && tomFinal ? `<span>Tom: ${tomFinal}</span>` : ""}
                    ${entrada.notas ? `<span>${entrada.notas}</span>` : ""}
                </div>
            </div>
            <div class="export-corpo">
                ${renderizarCantico(dados, semitons, entrada.seccoes || null)}
            </div>
            <div class="export-rodape">
                ${dataCabecalho || ""} · página ${i + 1}/${total}
            </div>
        `;
        return pagina;
    }
};

// ============================================================================
// 3. MOTOR DE LAYOUT E ESCALA
// ============================================================================
const ExportLayout = {
    aplicarTamanho: (corpo, tamanho) => {
        corpo.style.setProperty("--export-body-size", `${tamanho}px`);
        corpo.style.setProperty("--export-acorde-size", `${Math.max(11, tamanho * 0.85)}px`);
        corpo.style.setProperty("--export-label-size", `${Math.max(9, tamanho * 0.65)}px`);
    },

    calcularPlano: (H, W, A, L, conf) => {
        const meiaLargura = (W - conf.gapColunas) / 2;
        if (A <= H && L <= W) return { colunas: 1, tamanho: conf.fontIdeal };

        const escalaAltura = Math.min(1, H / A);
        if (L * escalaAltura >= meiaLargura) {
            return { colunas: 1, tamanho: Math.max(conf.fontMin, conf.fontIdeal * escalaAltura) };
        }

        const escalaLargura = Math.min(1, meiaLargura / L);
        const escalaFinal = (A * escalaLargura) <= (2 * H) ? escalaLargura : (2 * H) / A;
        
        return { colunas: 2, tamanho: Math.max(conf.fontMin, conf.fontIdeal * escalaFinal) };
    },

    dividirEmColunas: (corpo, maxH, colW) => {
        const seccoes = Array.from(corpo.querySelectorAll(".seccao"));
        if (!seccoes.length) return; 

        const alturaTotal = seccoes.reduce((soma, sec) => soma + sec.offsetHeight, 0);
        let [acumulado, indiceDivisao] = [0, Math.max(1, seccoes.length)];

        for (let i = 0; i < seccoes.length; i++) {
            if (acumulado >= alturaTotal / 2) { indiceDivisao = i; break; }
            acumulado += seccoes[i].offsetHeight;
        }

        const criarColuna = () => {
            const col = document.createElement("div");
            col.className = "export-coluna";
            Object.assign(col.style, { width: `${colW}px`, maxWidth: `${colW}px`, height: `${maxH}px` });
            return col;
        };

        const [col1, col2] = [criarColuna(), criarColuna()];
        seccoes.forEach((sec, i) => (i < indiceDivisao ? col1 : col2).appendChild(sec));
        
        corpo.replaceChildren(col1, col2);
        Object.assign(corpo.style, { flexDirection: "row", gap: `${ExportConfig.layout.gapColunas}px` });
    },

    ajustarPagina: (pagina) => {
        const corpo = pagina.querySelector(".export-corpo");
        if (!corpo) return;

        // 1. Limpamos restrições manuais para o flexbox assumir o tamanho natural exato.
        corpo.style.height = "";
        corpo.style.maxHeight = "";

        // 2. Medir tamanho "sem limites" para avaliar o plano.
        ExportLayout.aplicarTamanho(corpo, ExportConfig.layout.fontIdeal);
        corpo.classList.add("medindo-natural");
        const { scrollHeight: A, scrollWidth: L } = corpo;
        corpo.classList.remove("medindo-natural");

        // 3. Obter o espaço que o flexbox realmente alocou 
        // (Fallback aritmético super restrito caso o DOM atrase a renderização)
        const cab = pagina.querySelector(".export-cabecalho");
        const rod = pagina.querySelector(".export-rodape");
        const altCalc = pagina.clientHeight - (cab?.offsetHeight || 0) - (rod?.offsetHeight || 0) - 112; 
        const maxH = corpo.clientHeight > 10 ? corpo.clientHeight : altCalc;
        const maxW = corpo.clientWidth;

        // 4. Aplicar plano
        const plano = ExportLayout.calcularPlano(maxH, maxW, A, L, ExportConfig.layout);
        ExportLayout.aplicarTamanho(corpo, plano.tamanho);
        Object.assign(corpo.style, { height: `${maxH}px`, maxHeight: `${maxH}px` });

        if (plano.colunas === 2) {
            ExportLayout.dividirEmColunas(corpo, maxH, (maxW - ExportConfig.layout.gapColunas) / 2);
        }

        // 5. Ajuste fino baseado EXATAMENTE no clientHeight de onde o texto mora
        let iteracoes = 0;
        const testContainer = plano.colunas === 2 ? corpo.children : [corpo];
        
        while (Array.from(testContainer).some(c => c.scrollHeight > c.clientHeight + 1) && iteracoes++ < 50) {
            const atual = parseFloat(corpo.style.getPropertyValue("--export-body-size"));
            if (atual <= ExportConfig.layout.fontMin) break;
            ExportLayout.aplicarTamanho(corpo, atual - 0.25);
        }
    }
};

// ============================================================================
// 4. SERVIÇOS DE EXPORTAÇÃO (PDF/ZIP)
// ============================================================================
const ExportService = {
    utils: {
        nomeSeguro: (nome = "folha") => nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[<>:"/\\|?*\x00-\x1F\s]+/g, "-").toLowerCase(),
        dataHoje: (dataStr) => new Date(dataStr ? `${dataStr}T00:00:00` : Date.now()).toLocaleDateString("pt-PT"),
        downloadBlob: (blob, nome) => {
            const url = URL.createObjectURL(blob);
            const a = Object.assign(document.createElement("a"), { href: url, download: nome });
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        },
        carregarScript: (url, checkFn) => new Promise((resolve, reject) => {
            if (checkFn()) return resolve();
            const s = Object.assign(document.createElement("script"), { src: url, async: true, onload: () => checkFn() ? resolve() : reject(), onerror: reject });
            document.head.appendChild(s);
        })
    },

    prepararDependencias: async (formato) => {
        await ExportService.utils.carregarScript("https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js", () => window.html2canvas);
        if (formato === "pdf") await ExportService.utils.carregarScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js", () => window.jspdf);
        else await ExportService.utils.carregarScript("https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js", () => window.JSZip);
    },

    gerar: async (formato, opcoes) => {
        const { folha } = obterEstadoFolha();
        const itens = (await Promise.all(
            folha.momentos.flatMap(m => m.canticos.map(async c => ({ momento: m, entrada: c, canticoData: await carregarCantico(c.canticoId) })))
        )).filter(i => i.canticoData);

        if (!itens.length) return alert("Não há cânticos para exportar.");

        await ExportService.prepararDependencias(formato);

        // Gerar QR Code para a folha
        const qrCodeBase64 = await ExportQR.obterBase64(folha.id);

        // Contentor Invisível
        const root = Object.assign(document.createElement("div"), { style: "position:fixed; left:-10000px; top:0; z-index:-1; background:#fff;" });
        document.body.appendChild(root);

        try {
            const dataCab = ExportService.utils.dataHoje(folha.data);
            const paginas = itens.map((item, i) => {
                const pagina = ExportDOM.criarPagina(item, i, itens.length, opcoes, folha.titulo, dataCab);
                
                if (qrCodeBase64) {
                    const imgQR = document.createElement("img");
                    imgQR.src = qrCodeBase64;
                    imgQR.className = "export-qrcode";
                    imgQR.alt = "QR Code";
                    pagina.appendChild(imgQR);
                }
                return pagina;
            });

            paginas.forEach(p => root.appendChild(p));
            await new Promise(requestAnimationFrame);
            paginas.forEach(ExportLayout.ajustarPagina);
            await new Promise(r => setTimeout(r, 50)); // Tempo para render DOM

            const canvasOpts = { scale: 2, backgroundColor: "#ffffff", useCORS: true };
            const nomeBase = ExportService.utils.nomeSeguro(folha.titulo);

            if (formato === "pdf") {
                const pdf = new window.jspdf.jsPDF({ orientation: "p", unit: "pt", format: "a4" });
                for (let i = 0; i < paginas.length; i++) {
                    if (i > 0) pdf.addPage();
                    const canvas = await window.html2canvas(paginas[i], canvasOpts);
                    const ratio = Math.min(pdf.internal.pageSize.getWidth() / canvas.width, pdf.internal.pageSize.getHeight() / canvas.height);
                    pdf.addImage(canvas.toDataURL("image/png"), "PNG", (pdf.internal.pageSize.getWidth() - (canvas.width * ratio)) / 2, 0, canvas.width * ratio, canvas.height * ratio);
                }
                pdf.save(`${nomeBase}.pdf`);
            } else {
                const zip = new window.JSZip();
                for (let i = 0; i < paginas.length; i++) {
                    const canvas = await window.html2canvas(paginas[i], canvasOpts);
                    const titulo = ExportService.utils.nomeSeguro(itens[i].canticoData?.dados?.meta?.title || `cantico-${i + 1}`);
                    zip.file(`${String(i + 1).padStart(2, "0")}-${titulo}.png`, await new Promise(r => canvas.toBlob(r, "image/png")));
                }
                ExportService.utils.downloadBlob(await zip.generateAsync({ type: "blob" }), `${nomeBase}.zip`);
            }
        } finally {
            root.remove();
        }
    }
};

// ============================================================================
// 5. INTERFACE DE UTILIZADOR (UI)
// ============================================================================
const ExportUI = {
    obterOpcoes: () => ({
        formato: document.getElementById("painel-exportacao")?.dataset.formato || "pdf",
        incluirNomeMomento: document.getElementById("exp-momento")?.checked,
        incluirNomeCantico: document.getElementById("exp-cantico")?.checked,
        incluirTom: document.getElementById("exp-tom")?.checked,
        incluirTitulosSeccao: document.getElementById("exp-seccoes")?.checked,
        incluirAcordes: document.getElementById("exp-acordes")?.checked
    }),

    fechar: () => {
        document.getElementById("overlay-exportacao")?.classList.remove("overlay-visivel");
        document.getElementById("painel-exportacao")?.classList.replace("painel-aberto", "painel-fechado");
    },

    abrir: () => {
        // Criar ou obter elementos sem tentar reatribuir o 'dataset' diretamente
        let overlay = document.getElementById("overlay-exportacao") || Object.assign(document.createElement("div"), { id: "overlay-exportacao", className: "overlay" });
        let painel = document.getElementById("painel-exportacao") || Object.assign(document.createElement("div"), { id: "painel-exportacao", className: "painel" });
        
        // Atribuir o dataset da forma correta
        painel.dataset.formato = painel.dataset.formato || "pdf";
        
        if (!overlay.parentNode) document.body.appendChild(overlay);
        if (!painel.parentNode) document.body.appendChild(painel);

        overlay.className = "overlay overlay-visivel";
        painel.className = "painel painel-aberto";
        
        overlay.onclick = (e) => e.target === overlay && ExportUI.fechar();

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
                            ${[['exp-momento', 'Nome do momento'], ['exp-cantico', 'Nome do cântico'], ['exp-tom', 'Tom original / selecionado'], ['exp-seccoes', 'Títulos de estrofes/refrão'], ['exp-acordes', 'Acordes']]
                                .map(([id, label]) => `<label class="export-opcao"><input type="checkbox" id="${id}" checked> ${label}</label>`).join('')}
                        </div>
                    </div>
                    <div id="export-status" class="export-status"></div>
                    <button id="btn-exportar-confirmar" class="btn-primario">Exportar</button>
                </div>
            </div>
        `;

        // Eventos
        document.getElementById("btn-fechar-exportacao").onclick = ExportUI.fechar;
        document.querySelectorAll(".btn-formato-export").forEach(btn => btn.onclick = () => {
            painel.dataset.formato = btn.dataset.formato;
            document.querySelectorAll(".btn-formato-export").forEach(b => b.classList.remove("ativo"));
            btn.classList.add("ativo");
        });

        document.getElementById("btn-exportar-confirmar").onclick = async function() {
            const status = document.getElementById("export-status");
            try {
                this.disabled = true;
                if (status) status.textContent = "A preparar exportação...";
                await ExportService.gerar(ExportUI.obterOpcoes().formato, ExportUI.obterOpcoes());
                if (status) status.textContent = "Exportação concluída.";
                ExportUI.fechar();
            } catch (e) {
                console.error("Erro na exportação:", e);
                if (status) status.textContent = "Erro na exportação.";
                alert("Não foi possível exportar a folha.");
            } finally {
                this.disabled = false;
            }
        };
    }
};

// Como usar (mantendo a API original que as outras partes do seu código possam estar a chamar):
function abrirOverlayExportacao() { ExportUI.abrir(); }