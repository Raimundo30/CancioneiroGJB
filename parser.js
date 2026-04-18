// =============================================================================
// parser.js — Parser de ChordPro para o Cancioneiro
// =============================================================================

// -----------------------------------------------------------------------------
// SECÇÃO 1: Conversão de notação de acordes (CDEFGAB ↔ Dó Ré Mi...)
// -----------------------------------------------------------------------------

// Mapa de conversão: notação anglo-saxónica → notação latina
const ACORDES_PARA_LATINO = {
	"C": "Dó", "C#": "Dó#", "Db": "Réb",
	"D": "Ré", "D#": "Ré#", "Eb": "Mib",
	"E": "Mi",
	"F": "Fá", "F#": "Fá#", "Gb": "Solb",
	"G": "Sol", "G#": "Sol#", "Ab": "Láb",
	"A": "Lá", "A#": "Lá#", "Bb": "Sib",
	"B": "Si"
};

// Mapa inverso: notação latina → anglo-saxónica (gerado automaticamente)
const ACORDES_PARA_ANGLO = Object.fromEntries(
	Object.entries(ACORDES_PARA_LATINO).map(([anglo, latino]) => [latino, anglo])
);

/**
 * Converte a nota base de um acorde entre notações.
 * Exemplos:
 *   converterAcorde("Am", "latino")  → "Lám"
 *   converterAcorde("F#maj7", "latino") → "Fá#maj7"
 *   converterAcorde("Lám", "anglo")  → "Am"
 *
 * @param {string} acorde - O acorde a converter (ex: "Am", "F#7", "Lám")
 * @param {"latino"|"anglo"} para - Notação de destino
 * @returns {string} O acorde convertido
 */
function converterAcorde(acorde, para) {
	// Se estiver entre parênteses (ex: "(B F G)"), extrai o interior e converte
	if (acorde.startsWith("(") && acorde.endsWith(")")) {
		return "(" + converterAcorde(acorde.slice(1, -1), para) + ")";
	}

	// Se tiver múltiplos acordes separados por espaço (ex: "A D G")
	if (acorde.includes(" ")) {
		return acorde.split(" ").map(parte => converterAcorde(parte, para)).join(" ");
	}

	// Se for acorde composto com várias barras (ex: "A/C#/G")
	if (acorde.includes("/")) {
		return acorde.split("/").map(parte => converterAcorde(parte, para)).join("/");
	}
	
	const mapa = para === "latino" ? ACORDES_PARA_LATINO : ACORDES_PARA_ANGLO;

	// Tenta encontrar a nota base mais longa primeiro (ex: "Ab" antes de "A")
	// Ordena as chaves por comprimento decrescente para evitar matches parciais
	const chaves = Object.keys(mapa).sort((a, b) => b.length - a.length);

	for (const chave of chaves) {
	if (acorde.startsWith(chave)) {
		const sufixo = acorde.slice(chave.length); // ex: "m", "7", "maj7", "m7b5"
		return mapa[chave] + sufixo;
	}
	}

	// Se não encontrou correspondência, devolve o acorde sem alteração
	return acorde;
}

// -----------------------------------------------------------------------------
// SECÇÃO 2: Parser de uma linha com acordes
// -----------------------------------------------------------------------------

/**
 * Faz parse de uma linha ChordPro com acordes embutidos.
 * Exemplo:
 *   "[Am]Senhor, [F]eu te a[C]mo"
 * Devolve um array de tokens:
 *   [
 *     { chord: "Am", text: "Senhor, " },
 *     { chord: "F",  text: "eu te a"  },
 *     { chord: "C",  text: "mo"       }
 *   ]
 *
 * Se uma sílaba não tem acorde, o campo chord é null:
 *   "Texto sem acordes" → [{ chord: null, text: "Texto sem acordes" }]
 *
 * @param {string} linha - Uma linha de texto ChordPro
 * @returns {Array<{chord: string|null, text: string}>}
 */
function parseLinha(linha) {
	const tokens = [];
	// Expressão regular que encontra [ACORDE] seguido de texto (possivelmente vazio)
	const regex = /\[([^\]]+)\]([^\[]*)/g;
	let match;
	let posicao = 0;

	// Verifica se a linha começa com texto antes do primeiro acorde
	const primeiroAcorde = linha.indexOf("[");
	if (primeiroAcorde > 0) {
	tokens.push({ chord: null, text: linha.slice(0, primeiroAcorde) });
	posicao = primeiroAcorde;
	}

	// Itera sobre todos os pares [acorde]texto
	while ((match = regex.exec(linha)) !== null) {
	tokens.push({
		chord: match[1], // o acorde dentro de []
		text: match[2]   // o texto que se segue ao acorde
	});
	posicao = regex.lastIndex;
	}

	// Se a linha não tem nenhum acorde, devolve-a como texto simples
	if (tokens.length === 0) {
	tokens.push({ chord: null, text: linha });
	}

	return tokens;
}

// -----------------------------------------------------------------------------
// SECÇÃO 3: Parser principal — transforma um ficheiro .cho num objeto JS
// -----------------------------------------------------------------------------

/**
 * Faz parse de um ficheiro ChordPro completo.
 *
 * @param {string} texto - O conteúdo completo do ficheiro .cho
 * @returns {{
 *   meta: {title: string, key: string, author: string, [key: string]: string},
 *   sections: Array<{type: string, label: string, lines: Array}>
 * }}
 */
function parseChordPro(texto) {
	const resultado = {
	meta: {},
	sections: []
	};

	const linhas = texto.split("\n");
	let seccaoAtual = null; // a secção que está a ser construída

	for (let linha of linhas) {
		linha = linha.trim();

		// Ignora linhas vazias fora de uma secção
		// (dentro de uma secção, linhas vazias são separadores de estrofes)
		if (linha === "") {
			if (seccaoAtual) {
			// Linha vazia dentro de uma secção: adiciona marcador de parágrafo
			// (útil para separar blocos de texto dentro da mesma secção)
				seccaoAtual.lines.push(null);
			}
			continue;
		}

		// --- Diretivas: linhas que começam e terminam com {} ---
		if (linha.startsWith("{") && linha.endsWith("}")) {
			const interior = linha.slice(1, -1); // remove as chavetas
			const duaPontos = interior.indexOf(":");

			let chave, valor;
			if (duaPontos !== -1) {
				chave = interior.slice(0, duaPontos).trim().toLowerCase();
				valor = interior.slice(duaPontos + 1).trim();
			} else {
				chave = interior.trim().toLowerCase();
				valor = "";
			}

			// Diretivas de metadados
			if (["title", "t", "subtitle", "key", "author", "composer",
						"capo", "tempo", "time", "duration"].includes(chave)) {
				// Normaliza aliases comuns
				if (chave === "t") chave = "title";
				resultado.meta[chave] = valor;
				continue;
			}

			// Diretivas de início de secção
			if (chave === "start_of_verse" || chave === "sov") {
				seccaoAtual = { type: "verse", label: valor || "Estrofe", lines: [] };
				continue;
			}
			if (chave === "start_of_chorus" || chave === "soc") {
				seccaoAtual = { type: "chorus", label: valor || "Refrão", lines: [] };
				continue;
			}
			if (chave === "start_of_bridge" || chave === "sob") {
				seccaoAtual = { type: "bridge", label: valor || "Ponte", lines: [] };
				continue;
			}

			// Diretivas de fim de secção
			if (["end_of_verse", "eov", "end_of_chorus", "eoc",
						"end_of_bridge", "eob"].includes(chave)) {
				if (seccaoAtual) {
					resultado.sections.push(seccaoAtual);
					seccaoAtual = null;
				}
				continue;
			}

			// Comentário inline (aparece como nota na letra)
			if (chave === "comment" || chave === "c") {
				const linhaComentario = [{ chord: null, text: valor, isComment: true }];
				if (seccaoAtual) {
					seccaoAtual.lines.push(linhaComentario);
				}
				continue;
			}

			// Diretiva desconhecida — guarda mesmo assim para não perder informação
			resultado.meta[`_${chave}`] = valor;
			continue;
		}

		// --- Linha de letra (com ou sem acordes) ---
		const tokens = parseLinha(linha);

		if (seccaoAtual) {
			seccaoAtual.lines.push(tokens);
		} else {
			// Linha fora de qualquer secção — cria uma secção genérica
			// (útil para ficheiros .cho simples sem diretivas de estrutura)
			seccaoAtual = { type: "verse", label: "", lines: [tokens] };
		}
	}

	// Se o ficheiro terminou sem diretiva de fecho, guarda a secção pendente
	if (seccaoAtual) {
		resultado.sections.push(seccaoAtual);
	}

	return resultado;
}


// -----------------------------------------------------------------------------
// SECÇÃO 4: Transposição de acordes
// -----------------------------------------------------------------------------

// Escala cromática em sustenidos e bemóis
const ESCALA_SUSTENIDOS = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const ESCALA_BEMOIS     = ["C","D♭","D","E♭","E","F","G♭","G","A♭","A","B♭","B"];

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

	// Remove espaços extras
	acorde = acorde.trim();

	// Se estiver entre parênteses (ex: "(B F G)"), extrai o interior e transpõe
    if (acorde.startsWith("(") && acorde.endsWith(")")) {
        return "(" + transporAcorde(acorde.slice(1, -1), semitons) + ")";
    }

	// Se tiver múltiplos acordes separados por espaço (ex: "A D G")
    if (acorde.includes(" ")) {
        return acorde.split(" ").map(parte => transporAcorde(parte, semitons)).join(" ");
    }

	// Se for acorde composto com várias barras (ex: "A/C#/G")
    if (acorde.includes("/")) {
        return acorde.split("/").map(parte => transporAcorde(parte, semitons)).join("/");
    }
	
	// Encontra a nota base (pode ter # ou ♭)
	const match = acorde.match(/^([A-G][#♭]?)(.*)/);
	if (!match) return acorde;

	const notaBase = match[1];
	const sufixo   = match[2];

	// Determina qual escala usar (preferir bemóis se a nota base já usa bemol)
	const escala = notaBase.includes("♭") ? ESCALA_BEMOIS : ESCALA_SUSTENIDOS;

	const indiceAtual = escala.indexOf(notaBase);
	if (indiceAtual === -1) return acorde;

	// Calcula o novo índice (o % 12 garante que fica dentro da escala)
	const novoIndice = ((indiceAtual + semitons) % 12 + 12) % 12;
	return escala[novoIndice] + sufixo;
}

// -----------------------------------------------------------------------------
// SECÇÃO 5: RENDERIZAR CÂNTICO
// ------------------------------------------------------------------------------

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

	const linhaTemAcordes = tokens.some(token => token.chord);
	const espacoParaAcordes = mostrarAcordes && linhaTemAcordes;

	let html = '<div class="linha-letra">';

	for (const token of tokens) {
		if (token.chord && mostrarAcordes) {
			// Transpõe e converte notação
			let acorde = transporAcorde(token.chord, semitons);
			if (notacao === "latino") {
				acorde = converterAcorde(acorde, "latino");
			}
			html += `<span class="token">
			<span class="acorde">${acorde}</span>
			<span class="silaba">${token.text || "\u00A0"}</span>
			</span>`;
		} else {
			// Sem acorde — texto simples (mas com espaço reservado se acordes visíveis)
			html += `<span class="token">
			${espacoParaAcordes ? '<span class="acorde acorde-vazio">\u00A0</span>' : ''}
			<span class="silaba">${token.text}</span>
			</span>`;
		}
	}

	html += '</div>';
	return html;
}


/**
 * Ajusta o tamanho da letra de um cântico para que a linha mais longa se encaixe na largura do contentor.
 * A função é chamada após renderizar o cântico e também ao redimensionar a janela.
 *
 * @param {HTMLElement} container - O elemento que contém o cântico renderizado
 */
function ajustarTamanhoLetra(container) {
	if (!container) return;
	
	// 1. Define um tamanho base pequeno temporário para medir
	container.style.setProperty('--font-size-acorde', '10px');
	container.style.setProperty('--font-size-silaba', '10px');
	container.style.setProperty('--font-size-label', '8px');

	const containerWidth = container.clientWidth;
	let maxLinhaWidth = 0;

	// 2. Encontra a largura real da maior linha
	const linhas = container.querySelectorAll('.linha-letra');
	linhas.forEach(linha => {
		linha.style.width = 'max-content';
		const w = linha.scrollWidth;
		if (w > maxLinhaWidth) maxLinhaWidth = w;
		linha.style.width = '';
	});

	// 3. Aplica a proporção (base 10) ajustada à largura disponível
	if (maxLinhaWidth > 0) {
		const ratio = containerWidth / maxLinhaWidth;
		let novoTamanho = (10 * ratio) - 0.5;

		// Lê a variável CSS ou assume 35px como defeito
		const maxStr = getComputedStyle(document.documentElement).getPropertyValue('--font-size-max');
		const maxVal = parseFloat(maxStr) || 35;

		// Limite máximo para não ficar gigante em refrões curtos
		novoTamanho = Math.min(novoTamanho, maxVal); 
		// Limite mínimo de segurança
        novoTamanho = Math.max(novoTamanho, 5); 

		// Só aplica se não estiver vazio
		container.style.setProperty('--font-size-acorde', novoTamanho + 'px');
		container.style.setProperty('--font-size-silaba', novoTamanho + 'px');
		container.style.setProperty('--font-size-label', (novoTamanho * 0.8) + 'px');
	}
}


/**
 * Renderiza um cântico completo a partir dos dados do parser.
 * Cada secção é um <div> com classe "seccao" e tipo específico (ex: "seccao-verse").
 * As linhas de cada secção são renderizadas com renderizarLinha().
 * 
 * @param {object} dados - Resultado do parseChordPro()
 * @returns {HTMLElement} Elemento HTML com o cântico renderizado
 */
function renderizarCantico(dados, semitons = 0) {
	const notacao         = Cancioneiro.preferencias.obter("notacao");
	const mostrarAcordes  = Cancioneiro.preferencias.obter("mostrarAcordes");

	const container = document.createElement("div");
	container.className = "cantico-letra"; // GARANTE QUE AS VARIÁVEIS CSS SÃO RECALCULADAS NESTE NÍVEL
	container.innerHTML = ""; // limpa conteúdo anterior

	for (const seccao of dados.sections) {
		const soAcordes = seccao.lines.every(linha => linha.length === 1 && linha[0].chord);
		if (soAcordes && !mostrarAcordes) {
			// Se a secção tem apenas acordes e a opção de mostrar acordes está desativada, oculta a secção inteira
			continue;
		}

		const div = document.createElement("div");
		div.className = `seccao seccao-${seccao.type}`;

		// Etiqueta da secção (ex: "Estrofe 1", "Refrão")
		// Confirma se secção tem apenas acordes (sem texto) para decidir se mostra a etiqueta
		if (seccao.label ) {
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

	return container.innerHTML ? container.outerHTML : "Erro a renderizar cântico.";
	// const container = document.getElementById("cantico-letra");
	// container.innerHTML = "";
	// container.appendChild(renderizarCantico(dadosCantico, canticoId));
}


// -----------------------------------------------------------------------------
// SECÇÃO x: Exportar as funções (para usar noutros ficheiros JS)
// -----------------------------------------------------------------------------

// Como estamos a usar ficheiros JS simples (sem módulos npm),
// guardamos tudo num objeto global acessível em qualquer página.
window.Cancioneiro = window.Cancioneiro || {};
window.Cancioneiro.parser = {
	parseChordPro,
	parseLinha,
	converterAcorde,
	ACORDES_PARA_LATINO,
	ACORDES_PARA_ANGLO
};