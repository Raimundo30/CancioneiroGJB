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
// SECÇÃO 4: Exportar as funções (para usar noutros ficheiros JS)
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