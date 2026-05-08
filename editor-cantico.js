/* ------------------------------------------------------------------------------
 * Editor de cânticos
 * ----------------------------------------------------------------------------- */

// Cache local para as edições
let canticoCache = {
	id: null,
	meta: { title: "", subtitle: "", author: "", key: "", capo: "", categorias: [] },
	sections: []
};

let todasCategoriasGlobais = [];

function inicializarTabs() {
	const botoes = document.querySelectorAll(".tab-btn");
	const conteudos = document.querySelectorAll(".tab-content");

	botoes.forEach(btn => {
		btn.addEventListener("click", () => {
			botoes.forEach(b => b.classList.remove("ativo"));
			conteudos.forEach(c => c.classList.add("oculto"));

			btn.classList.add("ativo");
			document.getElementById(btn.dataset.tab).classList.remove("oculto");

			if (btn.dataset.tab === "tab-acordes") {
				renderizarBlocoAcordes();
			}
			
			if (btn.dataset.tab === "tab-preview") {
				renderizarPreview();
			}
		});
	});
}

function inicializarCategorias() {
	const input = document.getElementById("edit-categorias-input");
	input.addEventListener("keydown", (e) => {
		if (e.key === "Enter" || e.key === ",") {
			e.preventDefault();
			adicionarCategoria(input.value);
			input.value = "";
		}
	});
	input.addEventListener("blur", () => {
		if (input.value.trim() !== "") {
			adicionarCategoria(input.value);
			input.value = "";
		}
	});
}

function adicionarCategoria(cat) {
	cat = cat.trim();
	if (!cat) return;
	if (!canticoCache.meta.categorias) canticoCache.meta.categorias = [];
	if (!canticoCache.meta.categorias.some(c => c.toLowerCase() === cat.toLowerCase())) {
		canticoCache.meta.categorias.push(cat);
		renderizarCategorias();
	}
}

function removerCategoria(catParaRemover) {
	if (!canticoCache.meta.categorias) return;
	canticoCache.meta.categorias = canticoCache.meta.categorias.filter(c => c !== catParaRemover);
	renderizarCategorias();
}

function renderizarCategorias() {
	const canticoCats = canticoCache.meta.categorias || [];
	const containerSelecionadas = document.getElementById("categorias-selecionadas");
	containerSelecionadas.innerHTML = canticoCats.map(cat => `
		<div class="tag-categoria">
			<span>${cat}</span>
			<span class="tag-remover" data-cat="${cat}">✕</span>
		</div>
	`).join("");

	containerSelecionadas.querySelectorAll(".tag-remover").forEach(btn => {
		btn.addEventListener("click", () => removerCategoria(btn.dataset.cat));
	});

	const containerSugestoes = document.getElementById("categorias-sugestoes");
	const disponiveis = todasCategoriasGlobais.filter(c => 
		!canticoCats.some(catSelecionada => catSelecionada.toLowerCase() === c.toLowerCase())
	);

	containerSugestoes.innerHTML = disponiveis.map(cat => `
		<div class="tag-sugestao" data-cat="${cat}">+ ${cat}</div>
	`).join("");

	containerSugestoes.querySelectorAll(".tag-sugestao").forEach(btn => {
		btn.addEventListener("click", () => adicionarCategoria(btn.dataset.cat));
	});
}

// -----------------------------------------------------------------------------
// Converte ChordPro em texto livre e acordes para o editor e vice-versa
// -----------------------------------------------------------------------------

// Exemplo de Estrutura
// {
//	textoLivre: "Senhor, eu te amo",
//	acordes: [
//		{ acorde: "Am", posicao: 0 },
//		{ acorde: "F", posicao: 8 },
//		{ acorde: "C", posicao: 13 }
//	]
// }

function parseLinhaChordPro(linha) {
	const regex = /\[([^\]]+)\]/g;
	let textoLivre = "";
	let acordes = [];
	let pos = 0;
	let match;
	let lastIndex = 0;

	while ((match = regex.exec(linha)) !== null) {
		textoLivre += linha.slice(lastIndex, match.index);
		pos = textoLivre.length;
		acordes.push({ acorde: match[1], posicao: pos });
		lastIndex = regex.lastIndex;
	}
	textoLivre += linha.slice(lastIndex);
	return { textoLivre, acordes };
}

function parseLinhaEditor(linhaRaw) {
	if (!linhaRaw) return null;
	if (!linhaRaw.trim() && !linhaRaw.includes("[")) return null;
	
	if (linhaRaw.trim().startsWith("{c:") && linhaRaw.trim().endsWith("}")) {
		return { isComment: true, textoLivre: linhaRaw.trim().slice(3, -1).trim() };
	}

	const regex = /\[(.*?)\]/g;
	let match;
	let textoSemAcordes = "";
	let acordes = [];
	let offset = 0;
	
	// Divide string e encontra posições puras, protegendo espaços iniciais e finais
	const partes = linhaRaw.split(regex);
	for (let i = 0; i < partes.length; i++) {
		if (i % 2 === 0) {
			textoSemAcordes += partes[i];
			offset += partes[i].length;
		} else {
			acordes.push({ posicao: offset, acorde: partes[i] });
		}
	}

	return { isComment: false, textoLivre: textoSemAcordes, acordes: acordes };
}

function stringifyLinhaEditor(linhaObj) {
	if (linhaObj === null) return "";
	if (linhaObj.isComment) return `{c: ${linhaObj.textoLivre}}`;

	let textoBase = linhaObj.textoLivre || "";
	
	// Lista ordenada do fim para o início para não estragar as posições já calculadas
	const acordesOrd = [...(linhaObj.acordes || [])].sort((a,b) => b.posicao - a.posicao);
	
	for (let ac of acordesOrd) {
		// Validação de segurança para garantir a colagem restrita ao tamanho (os limites agora são geridos nos eventos)
		const p = Math.max(0, Math.min(ac.posicao, textoBase.length));
		textoBase = textoBase.slice(0, p) + `[${ac.acorde}]` + textoBase.slice(p);
	}
	return textoBase;
}

// -----------------------------------------------------------------------------
// Metadados e Carregamento
// -----------------------------------------------------------------------------

async function carregarDadosCantico(canticoId, indiceGlobal) {
	if (!canticoId) return;

	const docData = await window.Cancioneiro.dbApi.carregarCantico(canticoId);
	if (!docData) {
		alert("Cântico não encontrado para edição.");
		return;
	}

	const dadosParsed = window.Cancioneiro.parser.parseChordPro(docData.conteudoChordPro);
	
	canticoCache.id = canticoId;
	canticoCache.meta = { ...dadosParsed.meta };
	
	// Carrega sections com o novo formato interno
	canticoCache.sections = dadosParsed.sections.map(sec => {
		const bloco = { type: sec.type, labelBase: sec.label || "", label: sec.label || "", linhas: [] };
		
		// Se o label for "Introdução", força o tipo para "instrumental"
		if ((bloco.labelBase || "").trim().toLowerCase() === "introdução") {
			bloco.type = "instrumental";
		}

		// Reconstrói as linhas raw usando as funcoes do ChordPro
		sec.lines.forEach(l => {
			if (l === null) {
				bloco.linhas.push(null);
			} else if (l.length === 1 && l[0].isComment) {
				bloco.linhas.push({ isComment: true, textoLivre: l[0].text });
			} else {
				let raw = l.map(t => (t.chord ? `[${t.chord}]` : "") + (t.text || "")).join("");
				bloco.linhas.push(parseLinhaChordPro(raw));
			}
		});
		return bloco;
	});

	canticoCache.sections.forEach(sec => {
		const textoBruto = sec.linhas.filter(l => l && !l.isComment).map(stringifyLinhaEditor).join("").trim();
		if (textoBruto === "" && sec.type !== "chorus") sec.type = "instrumental";
	});

	// MODDED
	// Nos blocos instrumentais, "[A B G]" é guardado como um único acorde "A B G".
	// Aqui separamos em acordes individuais para o editor poder lidar com cada um.
	canticoCache.sections.forEach(sec => {
		if (sec.type !== "instrumental") return;
		sec.linhas.forEach(linha => {
			if (!linha || linha.isComment) return;
			const expandidos = [];
			(linha.acordes || []).forEach(ac => {
				ac.acorde.trim().split(/\s+/).forEach(chord => {
					if (chord) expandidos.push({ acorde: chord, posicao: expandidos.length });
				});
			});
			linha.acordes = expandidos;
		});
	});

	const metaIndice = indiceGlobal.find(c => c.id === canticoId);
	if (metaIndice && metaIndice.categorias) {
		canticoCache.meta.categorias = [...metaIndice.categorias];
	}
	preencherFormularioMeta();
}

function preencherFormularioMeta() {
	document.getElementById("edit-titulo").value = canticoCache.meta.title || "";
	document.getElementById("edit-subtitulo").value = canticoCache.meta.subtitle || "";
	document.getElementById("edit-autor").value = canticoCache.meta.author || "";
	
	const notacao = window.Cancioneiro.preferencias.obter("notacao");
	let tom = canticoCache.meta.key || "";
	if (tom && notacao === "latino") {
		tom = window.Cancioneiro.parser.converterAcorde(tom, "latino");
	}
	
	const inputTom = document.getElementById("edit-tom");
	inputTom.value = tom;
	inputTom.placeholder = notacao === "latino" ? "Ex: Dó, Lám, Fá#m (Obrigatório)" : "Ex: C, Am, F#m (Obrigatório)";
	document.getElementById("edit-capo").value = canticoCache.meta.capo || "";
	renderizarCategorias();
}

// -----------------------------------------------------------------------------
// SECÇÃO: Editor de Blocos de Letra
// -----------------------------------------------------------------------------

function renderizarBlocosLetra() {
	const container = document.getElementById("editor-blocos-letra");
	container.innerHTML = "";
	const contagemEtiquetas = {};
	
	canticoCache.sections.forEach((sec, idx) => {
		if (!sec.labelBase) {
			if (sec.type === "instrumental") sec.labelBase = idx === 0 ? "Introdução" : "Instrumental";
			else sec.labelBase = sec.type === "chorus" ? "Refrão" : "Estrofe";
		}
		if (sec.type === "instrumental" && ["Introdução", "Instrumental"].includes(sec.labelBase)) {
			sec.labelBase = idx === 0 ? "Introdução" : "Instrumental";
		}
		sec.labelBase = sec.labelBase.replace(/\s+\d+$/, "").trim();
		contagemEtiquetas[sec.labelBase] = (contagemEtiquetas[sec.labelBase] || 0) + 1;
	});

	const contagemAtual = {};
	canticoCache.sections.forEach((sec, idx) => {
		let labelVisivel = sec.labelBase;
		let sufixoNumero = "";
		if (contagemEtiquetas[sec.labelBase] > 1 && sec.labelBase.toLowerCase() !== "introdução") {
			contagemAtual[sec.labelBase] = (contagemAtual[sec.labelBase] || 0) + 1;
			sufixoNumero = ` ${contagemAtual[sec.labelBase]}`;
			labelVisivel = `${sec.labelBase}${sufixoNumero}`;
		}
		sec.label = labelVisivel;

		const div = document.createElement("div");
		div.className = `bloco-editor ${sec.type === "chorus" ? "bloco-chorus" : ""} ${sec.type === "instrumental" ? "bloco-instrumental" : ""}`;
		div.dataset.idx = idx;

		// Extrai apenas o texto livre (sem as tags de acordes) para a aba da Letra
		const textoLimpo = (sec.linhas || []).map(linha => {
			if (linha === null) return "";
			if (linha.isComment) return `{c: ${linha.textoLivre}}`;
			return linha.textoLivre || "";
		}).join("\n");

		div.innerHTML = `
			<div class="bloco-editor-header">
				<select class="bloco-tipo" data-idx="${idx}">
					<option value="verse" ${sec.type === "verse" || !sec.type ? "selected" : ""}>Verso</option>
					<option value="chorus" ${sec.type === "chorus" ? "selected" : ""}>Refrão</option>
					<option value="instrumental" ${sec.type === "instrumental" ? "selected" : ""}>Instrumental</option>
				</select>
				<div class="bloco-label-container">
					<input type="text" class="bloco-label-input" value="${sec.label}" data-idx="${idx}">
				</div>
				<div class="btn-main btn-transparente" style="margin-left: auto;">
					<button class="btn-mover-bloco-cima" data-idx="${idx}" ${idx === 0 ? 'disabled' : ''}>↑</button>
					<button class="btn-mover-bloco-baixo" data-idx="${idx}" ${idx === canticoCache.sections.length - 1 ? 'disabled' : ''}>↓</button>
					<button class="btn-apagar bloco-remover" data-idx="${idx}">✕</button>
				</div>
			</div>
			<div class="bloco-editor-body">
				<textarea class="bloco-textarea" data-idx="${idx}" placeholder="Insira a letra...">${textoLimpo}</textarea>
			</div>
		`;
		container.appendChild(div);
	});

	if (!container.dataset.eventosLigados) {
		ligarEventosBlocos(container);
		container.dataset.eventosLigados = "true";
	}
}

function atualizarDadosBloco(idx, propriedade, valor) {
	const sec = canticoCache.sections[idx];
	if (propriedade === "type") {
		sec.type = valor;
		if (["Estrofe", "Refrão", "Introdução", "Instrumental"].includes(sec.labelBase)) sec.labelBase = ""; 
		if (valor === "instrumental") {
			// Garante sempre pelo menos uma linha para poder inserir acordes
			if (!sec.linhas || sec.linhas.length === 0) {
				sec.linhas = [{ isComment: false, textoLivre: " ", acordes: [] }];
			}
		}
	}
	if (propriedade === "labelBase") {
		sec.labelBase = valor.replace(/\s+\d+$/, "").trim();
		sec.label = valor.trim();
	}
	if (propriedade === "texto" && sec.type !== "instrumental") {
		const linhasAnteriores = sec.linhas || [];
		sec.linhas = valor.split("\n").map((l, i) => {
			if (!l.trim()) return null;
			if (l.trim().startsWith("{c:") && l.trim().endsWith("}")) {
				return { isComment: true, textoLivre: l.trim().slice(3, -1).trim() };
			}
			const linhaAntiga = linhasAnteriores[i];
			const acordesAntigos = (linhaAntiga && !linhaAntiga.isComment) ? linhaAntiga.acordes : [];
			return { isComment: false, textoLivre: l, acordes: acordesAntigos };
		});
	}
}

function ligarEventosBlocos(container) {
	container.addEventListener("change", (e) => {
		const target = e.target;
		const idx = target.dataset.idx;

		if (target.classList.contains("bloco-tipo")) {
		   atualizarDadosBloco(idx, "type", target.value);
		   renderizarBlocosLetra();
		} else if (target.classList.contains("bloco-label-input")) {
		   atualizarDadosBloco(idx, "labelBase", target.value);
		   renderizarBlocosLetra();
		} else if (target.classList.contains("bloco-textarea")) {
		   atualizarDadosBloco(idx, "texto", target.value);
		}
	});

	container.addEventListener("click", (e) => {
		const target = e.target;
		const idx = parseInt(target.dataset.idx, 10);
		
		if (target.classList.contains("bloco-remover")) {
			canticoCache.sections.splice(idx, 1);
			renderizarBlocosLetra();
			renderizarBlocoAcordes();
		} else if (target.classList.contains("btn-mover-bloco-cima") && idx > 0) {
			[canticoCache.sections[idx - 1], canticoCache.sections[idx]] = [canticoCache.sections[idx], canticoCache.sections[idx - 1]];
			renderizarBlocosLetra();
			renderizarBlocoAcordes();
		} else if (target.classList.contains("btn-mover-bloco-baixo") && idx < canticoCache.sections.length - 1) {
			[canticoCache.sections[idx], canticoCache.sections[idx + 1]] = [canticoCache.sections[idx + 1], canticoCache.sections[idx]];
			renderizarBlocosLetra();
			renderizarBlocoAcordes();
		}
	});
}

// -----------------------------------------------------------------------------
// SECÇÃO: Editor de Acordes (Visualização e Drag&Drop)
// -----------------------------------------------------------------------------

let acordesBlocoAtual = 0;
let acordeArrastado = null;
let slotAlvoAtual = null;

function inicializarNavAcordes() {
	const navComp = document.getElementById("acordes-nav-comp");
	if (!navComp) return;

	navComp.addEventListener("click", (e) => {
		const target = e.target;
		if (target.id === "btn-anterior" && acordesBlocoAtual > 0) {
			acordesBlocoAtual--; renderizarBlocoAcordes();
		} else if (target.id === "btn-seguinte" && acordesBlocoAtual < canticoCache.sections.length - 1) {
			acordesBlocoAtual++; renderizarBlocoAcordes();
		} else if (target.id === "btn-indice") {
			const dropdown = document.getElementById("acordes-blocos-dropdown");
			if (!dropdown) return;
			if (!dropdown.classList.contains("oculto")) { dropdown.classList.add("oculto"); return; }
			dropdown.innerHTML = canticoCache.sections.map((sec, idx) => `
				<li class="filtro-drop-item ${idx === acordesBlocoAtual ? 'ativo' : ''}" data-idx="${idx}">
					${sec.label || "(Sem etiqueta)"}
				</li>
			`).join("");
			dropdown.classList.remove("oculto");
			e.stopPropagation();
		}
	});

	document.addEventListener("click", (e) => {
		const dropdown = document.getElementById("acordes-blocos-dropdown");
		if (!dropdown || dropdown.classList.contains("oculto")) return;
		if (e.target.classList.contains("filtro-drop-item") && e.target.closest("#acordes-blocos-dropdown")) {
			acordesBlocoAtual = parseInt(e.target.dataset.idx, 10);
			dropdown.classList.add("oculto");
			renderizarBlocoAcordes();
		} else if (e.target.id !== "btn-indice" && !dropdown.contains(e.target)) {
			dropdown.classList.add("oculto");
		}
	});
}

function renderizarBlocoAcordes() {
	const headerTitulo = document.getElementById("acordes-bloco-titulo");
	const contagem = document.getElementById("acordes-bloco-contador");
	const area = document.getElementById("editor-acordes-conteudo");
	
	const notacao = window.Cancioneiro.preferencias.obter("notacao");

	if (!headerTitulo || !area) return;

	if (canticoCache.sections.length === 0) {
		headerTitulo.textContent = "Sem blocos";
		contagem.textContent = "(0/0)";
		area.innerHTML = "<p class='pesquisa-vazio'>Adicione um bloco na aba de Letra primeiro.</p>";
		return;
	}

	if (acordesBlocoAtual >= canticoCache.sections.length) acordesBlocoAtual = canticoCache.sections.length - 1;
	if (acordesBlocoAtual < 0) acordesBlocoAtual = 0;

	const sec = canticoCache.sections[acordesBlocoAtual];
	headerTitulo.textContent = sec.label || "(Sem etiqueta)";
	contagem.textContent = `(${acordesBlocoAtual + 1}/${canticoCache.sections.length})`;

	if (sec.type === "chorus") {
		area.classList.add("seccao-chorus");
	} else {
		area.classList.remove("seccao-chorus");
	}
	
	// --- INSTRUMENTAL BLOCO ---
	if (sec.type === "instrumental") {
		// Garante pelo menos uma linha
		if (!sec.linhas || sec.linhas.length === 0) {
			sec.linhas = [{ textoLivre: "", acordes: [] }];
		}

		// Normaliza posições como índices sequenciais antes de cada render
		sec.linhas.forEach(linha => {
			if (!linha || linha.isComment) return;
			linha.acordes
				.sort((a, b) => a.posicao - b.posicao)
				.forEach((ac, i) => { ac.posicao = i; });
		});

		let html = "";
		(sec.linhas || []).forEach((linha, li) => {
			html += `<div class="linha-instrumental" data-li="${li}">`;
			(linha.acordes || []).forEach((ac, idx) => {
				const dChord = ac.acorde
					? window.Cancioneiro.parser.converterAcorde(ac.acorde, notacao)
					: '\u00A0';
				html += `<span class="token token-acorde-edit" data-li="${li}" data-pos="${idx}" data-chord="${ac.acorde || ''}" data-char=""><span class="acorde" draggable="true">${dChord}</span></span>`;
			});
			html += `<button class="btn-normal btn-add-acorde" data-li="${li}" title="Adicionar acorde">+</button>`;
			html += `</div>`;
		});
		html += `<button id="btn-add-linha" class="btn-normal btn-texto" style="margin-top:0.5rem;">+ Linha</button>`;

		area.innerHTML = html;

		// Evento: adicionar acorde no fim da linha
		area.querySelectorAll(".btn-add-acorde").forEach(btn => {
			btn.onclick = () => {
				const li = parseInt(btn.dataset.li, 10);
				const linha = sec.linhas[li];
				linha.acordes.push({ acorde: "", posicao: linha.acordes.length });
				renderizarBlocoAcordes();
				setTimeout(() => {
					const tokens = area.querySelectorAll(`.token-acorde-edit[data-li="${li}"]`);
					const novoToken = tokens[tokens.length - 1];
					if (novoToken) novoToken.click();
				}, 0);
			};
		});

		// Evento: adicionar linha
		const btnAddLinha = area.querySelector("#btn-add-linha");
		if (btnAddLinha) {
			btnAddLinha.onclick = (e) => {
				e.stopPropagation();
				// Sempre cria uma linha com pelo menos um slot de acorde para abrir o prompt imediatamente.
				const novaLinha = { textoLivre: "", acordes: [{ acorde: "", posicao: 0 }] };
				sec.linhas.push(novaLinha);
				renderizarBlocoAcordes();
				// Após render, abre o editor do acorde recém-criado
				setTimeout(() => {
					const liIdx = sec.linhas.length - 1;
					const token = area.querySelector(`.token-acorde-edit[data-li="${liIdx}"][data-pos="0"]`);
					if (token) {
						token.click();
					} else {
						// Fallback: dispara o botão de adicionar acorde da linha caso o token não exista
						const addBtn = area.querySelector(`.linha-instrumental[data-li="${liIdx}"] .btn-add-acorde`);
						if (addBtn) addBtn.click();
					}
				}, 0);
			};
		}

		// Reutiliza o mesmo sistema de eventos que os outros blocos (edição por modal + drag-and-drop)
		if (!area.dataset.eventosLigados) {
			ligarEventosAcordes(area);
			area.dataset.eventosLigados = "true";
		}
		return;
	}

	function criarSlot(li, pos, char, chord) {
		const dChar = (char === ' ' || char === '') ? '\u00A0' : char;
		
		// Converte a notação apenas para a vista (mantém "chord" original no data-chord)
		let dChord = '\u00A0';
		if (chord) {
			dChord = window.Cancioneiro.parser.converterAcorde(chord, notacao);
		}

		const cl = chord ? '' : 'acorde-vazio';
		const cSafe = char.replace(/"/g, '&quot;');
		return `<span class="token token-acorde-edit" data-li="${li}" data-pos="${pos}" data-chord="${chord || ''}" data-char="${cSafe}"><span class="acorde ${cl}" draggable="${!!chord}">${dChord}</span><span class="silaba">${dChar}</span></span>`;	
	}

	let html = "";
	(sec.linhas || []).forEach((linha, li) => {
		if (linha === null) { html += '<div class="linha-vazia"></div>'; return; }
		if (linha.isComment) { html += `<div class="linha-comentario">${linha.textoLivre}</div>`; return; }

		html += '<div class="linha-letra">';
		
		let texto = linha.textoLivre || "";
		const size = texto.length;


		// Pré buffer
		html += criarSlot(li, -2, "", null);
		html += criarSlot(li, -1, "", null);

		for (let pos = 0; pos <= size; pos++) {
			let ch = pos < size ? texto[pos] : ""; // Última casa vazia pro fim da linha
			let acordoNoEspaco = linha.acordes.find(a => a.posicao === pos);
			html += criarSlot(li, pos, ch, acordoNoEspaco ? acordoNoEspaco.acorde : null);
			
			// Renderiza multiplos acordes na mesma posição, se existirem e for no fim
			const extrasNaMesmaDrop = linha.acordes.filter(a => a.posicao === pos && a !== acordoNoEspaco);
			for(let ex of extrasNaMesmaDrop) {
				html += criarSlot(li, pos, "", ex.acorde);
			}
		}
		
		// Pós buffer
		for(let i=1; i<=10; i++) html += criarSlot(li, size + i, "", null);

		html += '</div>';
	});

	area.innerHTML = html || "<p class='pesquisa-vazio' style='text-align:center;'>Bloco vazio.</p>";

	if (!area.dataset.eventosLigados) {
		ligarEventosAcordes(area);
		area.dataset.eventosLigados = "true";
	}
}

// Limpa espaços no início e no fim da linha se já não houver texto nem acordes a justificá-los
function limparBufferLinha(linha) {
	if (!linha || linha.isComment) return;
	
	let texto = linha.textoLivre || "";
	
	// 1. Limpar espaços finais (Apara depois da última letra ou acorde)
	const maxPosAcorde = linha.acordes.length > 0 ? Math.max(...linha.acordes.map(a => a.posicao)) : -1;
	const maxTxtPos = texto.trimEnd().length;
	const corteFim = Math.max(maxTxtPos, maxPosAcorde);
	texto = texto.substring(0, corteFim);
	
	// 2. Limpar espaços iniciais invisíveis (se não houverem acordes em cima)
	const espacosIniciais = texto.match(/^\s*/)[0].length;
	if (espacosIniciais > 0) {
		const minPosAcorde = linha.acordes.length > 0 ? Math.min(...linha.acordes.map(a => a.posicao)) : texto.length;
		const remover = Math.min(espacosIniciais, minPosAcorde);
		if (remover > 0) {
			texto = texto.substring(remover);
			linha.acordes.forEach(a => a.posicao -= remover);
		}
	}
	
	linha.textoLivre = texto;
}

// Expande ativamente o início e o fim da linha, se soltarmos o acorde fora dos limites
function expandirBufferSeNecessario(linha, posDesejada) {
	let texto = linha.textoLivre || "";
	let novaPos = posDesejada;

	// Se soltou no lado esquerdo invisível, adiciona na íntegra a quantidade matemática de espaços no início
	if (posDesejada < 0) {
		const shift = Math.abs(posDesejada);
		texto = " ".repeat(shift) + texto;
		linha.acordes.forEach(a => a.posicao += shift);
		novaPos = 0; // O acorde fica garantidamente encaixado no índice zero (após encher de espaços para trás)
	} 
	// Se soltou no lado direito invisível, adiciona espaços no fim
	else if (posDesejada > texto.length) {
		texto = texto.padEnd(posDesejada, " ");
	}

	linha.textoLivre = texto;
	return novaPos;
}

// Reconstrói a linha manipulando as listas base no json
function setAcordeEmCache(li, posi, novoAcorde) {
	const sec = canticoCache.sections[acordesBlocoAtual];
	let linha = sec.linhas[li];
	
	// Assegura fisicamente o espaço necessário para a posição
	const posFinal = expandirBufferSeNecessario(linha, posi);

	// Substitui o espaço pela nova caixa de acorde
	linha.acordes = linha.acordes.filter(a => a.posicao !== posFinal);
	if (novoAcorde) {
		linha.acordes.push({ posicao: posFinal, acorde: novoAcorde });
	}
	
	limparBufferLinha(linha);
}

function ligarEventosAcordes(area) {
	area.addEventListener("dragstart", (e) => {
		if (e.target.classList.contains("acorde")) {
			const tk = e.target.closest(".token-acorde-edit");
			acordeArrastado = {
				li: parseInt(tk.dataset.li, 10),
				pos: parseInt(tk.dataset.pos, 10),
				chord: tk.dataset.chord
			};
			e.dataTransfer.effectAllowed = "move";
			setTimeout(() => e.target.style.opacity = "0.5", 0);
		}
	});

	area.addEventListener("dragend", (e) => {
		if (e.target.classList.contains("acorde")) e.target.style.opacity = "1";
		if (slotAlvoAtual) { slotAlvoAtual.classList.remove("slot-alvo"); slotAlvoAtual = null; }
		acordeArrastado = null;
	});

	area.addEventListener("dragover", (e) => {
		const destSlot = e.target.closest(".token-acorde-edit");
		if (destSlot) {
			e.preventDefault(); e.dataTransfer.dropEffect = "move";
			if (slotAlvoAtual !== destSlot) {
				if (slotAlvoAtual) slotAlvoAtual.classList.remove("slot-alvo");
				slotAlvoAtual = destSlot; slotAlvoAtual.classList.add("slot-alvo");
			}
		}
	});

	area.addEventListener("dragleave", (e) => {
		if (slotAlvoAtual && !slotAlvoAtual.contains(e.relatedTarget)) {
			slotAlvoAtual.classList.remove("slot-alvo"); slotAlvoAtual = null;
		}
	});

	area.addEventListener("drop", (e) => {
		e.preventDefault();
		if (slotAlvoAtual) { slotAlvoAtual.classList.remove("slot-alvo"); slotAlvoAtual = null; }

		const destSlot = e.target.closest(".token-acorde-edit");
		
		if (destSlot && acordeArrastado) {
			const destLi = parseInt(destSlot.dataset.li, 10);
			const destPos = parseInt(destSlot.dataset.pos, 10);
			const sourceLi = acordeArrastado.li;
			const sourcePos = acordeArrastado.pos;
			const sourceChord = acordeArrastado.chord;
			const destChordAtual = destSlot.dataset.chord;

			const sec = canticoCache.sections[acordesBlocoAtual];
			const linhaOrigem = sec.linhas[sourceLi];

			// 1. Remove ativamente da origem para não duplicar durante as operações
			linhaOrigem.acordes = linhaOrigem.acordes.filter(a => !(a.posicao === sourcePos && a.acorde === sourceChord));

			// 2. Coloca o que estava no destino para a origem (Troca)
			if (destChordAtual) {
				setAcordeEmCache(sourceLi, sourcePos, destChordAtual);
			}

			// 3. Coloca o que estava na origem no destino
			setAcordeEmCache(destLi, destPos, sourceChord);

			// Garante limpeza extra após operações cruzadas que envolvem várias linhas
			limparBufferLinha(sec.linhas[sourceLi]);

			renderizarBlocoAcordes();
			renderizarBlocosLetra();
		}
	});

	area.addEventListener("click", (e) => {
		
		if (e.target.id === "btn-add-acorde"){
			;
		}

		if (e.target.id === "btn-add-linha"){
			;
		}

		const tokenInfo = e.target.closest(".token-acorde-edit");
		if (!tokenInfo || e.target.closest("#input-acorde-ativo")) return;

		const exisInput = document.getElementById("input-acorde-ativo");
		if (exisInput) exisInput.querySelector("input").blur();

		const currentChord = tokenInfo.dataset.chord;
		tokenInfo.classList.add("editando");

		// Converte para a notação visual ao abrir o input
		const notacaoAtual = window.Cancioneiro.preferencias.obter("notacao");
		const editChord = currentChord ? window.Cancioneiro.parser.converterAcorde(currentChord, notacaoAtual) : '';

		const modal = document.createElement("div");
		modal.className = "modal-inserir-acorde";
		modal.id = "input-acorde-ativo";
		modal.innerHTML = `<input type="text" value="${editChord}" placeholder="Acorde">`;
		
		tokenInfo.appendChild(modal);
		const input = modal.querySelector("input");
		input.focus(); input.select();

		let guardado = false;
		function guardar() {
			if (guardado) return;
			guardado = true;
			const li = parseInt(tokenInfo.dataset.li, 10);
			const pos = parseInt(tokenInfo.dataset.pos, 10);
			
			// Converte de volta para a notação purista (Anglo) para garantir compatibilidade estrutural
			const rawVal = input.value.trim();
			const acordeParaGuardar = rawVal ? window.Cancioneiro.parser.converterAcorde(rawVal, "anglo") : null;

			setAcordeEmCache(li, pos, acordeParaGuardar);
			
			const sec = canticoCache.sections[acordesBlocoAtual];
			limparBufferLinha(sec.linhas[li]);

			// Se for bloco instrumental, e a linha ficou sem acordes, remove a linha
			// (exceto se for a única linha do bloco)
			if (sec && sec.type === "instrumental") {
				// linha pode ter sido alterada; recupera de forma segura
				const linhaAtual = sec.linhas[li];
				const temAcordes = linhaAtual && Array.isArray(linhaAtual.acordes) && linhaAtual.acordes.length > 0;
				if (!temAcordes && sec.linhas.length > 1) {
					// remove a linha criada vazia
					// nota: se li estiver fora de alcance, tenta remover a última linha
					const idxRemover = (li >= 0 && li < sec.linhas.length) ? li : sec.linhas.length - 1;
					sec.linhas.splice(idxRemover, 1);
				}
			}
			
			renderizarBlocoAcordes();
			renderizarBlocosLetra();
		}

		input.addEventListener("keydown", (ev) => {
			if (ev.key === "Enter") guardar();
			if (ev.key === "Escape") { guardado = true; tokenInfo.classList.remove("editando"); modal.remove(); }
		});
		input.addEventListener("blur", () => guardar());
	});
}

// -----------------------------------------------------------------------------
// SECÇÃO: Pré-visualização e Exportação
// -----------------------------------------------------------------------------

// Formata o Cântico de volta para uma string válida no padrão ChordPro
function gerarChordPro() {
	let cho = "";
	const m = canticoCache.meta;
	
	// Atualiza metadados com inputs
	m.title = document.getElementById("edit-titulo").value.trim();
	m.subtitle = document.getElementById("edit-subtitulo").value.trim();
	m.author = document.getElementById("edit-autor").value.trim();
	m.capo = document.getElementById("edit-capo").value.trim();
	
	const notacao = window.Cancioneiro.preferencias.obter("notacao");
	let tomInput = document.getElementById("edit-tom").value.trim();
	if (tomInput && notacao === "latino") {
		tomInput = window.Cancioneiro.parser.converterAcorde(tomInput, "anglo");
	}
	m.key = tomInput;

	if (m.title) cho += `{title: ${m.title}}\n`;
	if (m.subtitle) cho += `{subtitle: ${m.subtitle}}\n`;
	if (m.author) cho += `{author: ${m.author}}\n`;
	if (m.key) cho += `{key: ${m.key}}\n`;
	if (m.capo) cho += `{capo: ${m.capo}}\n`;
	cho += "\n";

	canticoCache.sections.forEach(sec => {
		let directive = "verse";
		if (sec.type === "instrumental") directive = "verse";
		if (sec.type === "chorus") directive = "chorus";
		
		cho += `{start_of_${directive}: ${sec.label}}\n`;

		//(sec.linhas || []).forEach(linha => {
		//	cho += stringifyLinhaEditor(linha) + "\n";
		//});

		// MODDED
		(sec.linhas || []).forEach(linha => {
			if (sec.type === "instrumental") {
				// Reagrupa os acordes individuais no formato [A B G]
				const acordes = (linha?.acordes || []).map(a => a.acorde).filter(Boolean);
				cho += acordes.length ? `[${acordes.join(" ")}]` : "";
			} else {
				cho += stringifyLinhaEditor(linha);
			}
			cho += "\n";
		});

		cho += `{end_of_${directive}}\n\n`;
	});
	
	return cho.trim();
}

function renderizarPreview() {
	const rawChordPro = gerarChordPro();
	const dados = window.Cancioneiro.parser.parseChordPro(rawChordPro);
	
	// Preenche Cabeçalho do Preview
	document.getElementById("preview-titulo").textContent = dados.meta.title || "(Sem título)";
	document.getElementById("preview-subtitulo").textContent = dados.meta.subtitle ? `(${dados.meta.subtitle})` : "";
	
	let detalhes = [];
	if (dados.meta.author) detalhes.push(dados.meta.author);
	if (dados.meta.key) detalhes.push(`Tom: ${window.Cancioneiro.parser.converterAcorde(dados.meta.key, window.Cancioneiro.preferencias.obter("notacao"))}`);
	if (canticoCache.meta.categorias && canticoCache.meta.categorias.length > 0) detalhes.push(canticoCache.meta.categorias.join(" · "));
	document.getElementById("preview-detalhes").textContent = detalhes.join(" · ");

	// Preenche Letra/Acordes
	const container = document.getElementById("preview-conteudo");
	container.innerHTML = renderizarCantico(dados, 0); // Reutiliza a sua função nativa de renderizar a vista de leitura
}

// -----------------------------------------------------------------------
// SECÇÃO: Guardar na Base de Dados
// -----------------------------------------------------------------------

async function guardarCantico() {
	const btnGuardar = document.getElementById("btn-guardar");
	const msgStatus = document.getElementById("msg-guardar-status");

	if (!btnGuardar) return;

	try {
		// Desabilita o botão e mostra estado de carregamento
		btnGuardar.disabled = true;
		btnGuardar.textContent = "⏳ A guardar...";
		msgStatus.textContent = "A guardar...";
		msgStatus.style.color = "var(--cor-texto-secundario)";

		// Gera o ChordPro atual
		const chordProContent = gerarChordPro();

		// Prepara os dados para guardar
		const canticoData = {
			titulo: canticoCache.meta.title || "",
			subtitulo: canticoCache.meta.subtitle || "",
			autor: canticoCache.meta.author || "",
			tom: canticoCache.meta.key || "",
			conteudoChordPro: chordProContent,
			dataModificacao: new Date().toISOString()
		};

		// Se é um cântico existente, atualiza; se não, cria um novo
		if (canticoCache.id) {
			// Atualiza cântico existente
			await window.Cancioneiro.dbApi.atualizarCantico(canticoCache.id, canticoData);

			// Também atualiza as categorias na base de dados se for necessário
			// (assumindo que existe um campo de categorias no documento)
			if (canticoCache.meta.categorias && canticoCache.meta.categorias.length > 0) {
				await window.Cancioneiro.dbApi.atualizarCantico(canticoCache.id, {
					categorias: canticoCache.meta.categorias
				});
			}

			msgStatus.textContent = "✓ Alterações guardadas com sucesso!";
			msgStatus.style.color = "#4CAF50";

			// Registra no Analytics
			if (window.gtag) {
				gtag('event', 'cantico_atualizado', {
					cantico_id: canticoCache.id,
					cantico_titulo: canticoCache.meta.title
				});
			}
		} else {
			//// Cria um novo cântico
			//const newId = await window.Cancioneiro.dbApi.criarCantico({
			//	...canticoData,
			//	categorias: canticoCache.meta.categorias || [],
			//	dataCriacao: new Date().toISOString()
			//});

			//canticoCache.id = newId;

			//msgStatus.textContent = "✓ Cântico criado com sucesso!";
			//msgStatus.style.color = "#4CAF50";

			//// Muda a URL para refletir o novo ID
			//window.history.replaceState({}, document.title, `editor-cantico.html?id=${newId}`);

			//// Registra no Analytics
			//if (window.gtag) {
			//	gtag('event', 'cantico_criado', {
			//		cantico_id: newId,
			//		cantico_titulo: canticoCache.meta.title
			//	});
			//}
		}

		// Reabilita o botão após 2 segundos
		setTimeout(() => {
			btnGuardar.disabled = false;
			btnGuardar.textContent = "💾 Guardar Alterações";
		}, 2000);

	} catch (erro) {
		console.error("Erro ao guardar cântico:", erro);
		msgStatus.textContent = "✗ Erro ao guardar. Tente novamente.";
		msgStatus.style.color = "#f44336";

		// Reabilita o botão
		btnGuardar.disabled = false;
		btnGuardar.textContent = "💾 Guardar Alterações";

		// Registra erro no Analytics
		if (window.gtag) {
			gtag('event', 'cantico_erro_guardado', {
				erro: erro.message
			});
		}
	}
}

function validarCantico() {
	const titulo = document.getElementById("edit-titulo").value.trim();
	const tom = document.getElementById("edit-tom").value.trim();

	if (!titulo) {
		alert("Por favor, insira um título para o cântico.");
		return false;
	}

	if (!tom) {
		alert("Por favor, insira um tom para o cântico.");
		return false;
	}

	return true;
}


// -----------------------------------------------------------------------------
// Inicialização
// -----------------------------------------------------------------------------
async function init() {
	const editorConteudo = document.getElementById("editor-conteudo");
	if (!editorConteudo) return;

	inicializarTabs();
	inicializarCategorias();
	inicializarNavAcordes(); 

	document.getElementById("btn-adicionar-bloco").addEventListener("click", () => {
		canticoCache.sections.push({ type: "verse", labelBase: "Estrofe", label: "Estrofe", linhas: [] });
		renderizarBlocosLetra();
	});

	const btnVoltar = document.getElementById("btn-voltar");
	const params = new URLSearchParams(window.location.search);
	const canticoId = params.get("id");
	
	if (btnVoltar) {
		btnVoltar.addEventListener("click", () => {
			if (canticoId) window.location.href = `cantico.html?id=${canticoId}`;
			else window.location.href = "index.html";
		});
	}

	// --- GUARDAR CÂNTICO ---
	const btnGuardar = document.getElementById("btn-guardar");
	if (btnGuardar) {
		btnGuardar.addEventListener("click", async () => {
			if (validarCantico()) {
				await guardarCantico();
				// redireciona para a página do cântico
				if (canticoId) {
					window.location.href = `cantico.html?id=${canticoId}`;
				}
			}
		});
	}

	const indice = await window.Cancioneiro.dbApi.carregarIndice();
	const setCats = new Set();
	indice.forEach(c => c.categorias?.forEach(cat => setCats.add(cat)));
	todasCategoriasGlobais = Array.from(setCats).sort();

	if (canticoId) {
		await carregarDadosCantico(canticoId, indice);
		renderizarBlocosLetra();
	} else {
		renderizarCategorias();
		renderizarBlocosLetra();
	}

	document.addEventListener("preferencia-alterada", (e) => {
		if (e.detail.chave === "notacao") {
			const inputTom = document.getElementById("edit-tom");
			if (inputTom && inputTom.value.trim()) {
				inputTom.value = window.Cancioneiro.parser.converterAcorde(inputTom.value.trim(), e.detail.valor);
				inputTom.placeholder = e.detail.valor === "latino" ? "Ex: Dó, Lám, Fá#m (Obrigatório)" : "Ex: C, Am, F#m (Obrigatório)";
			}
			
			// Força o redesenho dos acordes virtuais e botões com a nova notação
			renderizarBlocoAcordes();
		}
	});

	// Google Analytics: envia evento de page_view do editor
	if (window.gtag) {
		const isNovo = !canticoId;
		const eventParams = {
			page_path: `/editor.html${canticoId ? `?id=${canticoId}` : ''}`,
			page_title: document.title,
			page_type: 'editor',
			editor: isNovo ? 'novo' : 'editar'
		};

		if (canticoId) {
			const metaCantico = indice.find(c => c.id === canticoId);
			eventParams.cantico_id = canticoId;
			eventParams.cantico_titulo = canticoCache.meta.title || metaCantico?.titulo;
		}

		gtag('event', 'page_view', eventParams);
	}
}

init();