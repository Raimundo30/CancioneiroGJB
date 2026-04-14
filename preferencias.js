// preferencias.js — Gestão de preferências globais do utilizador

window.Cancioneiro = window.Cancioneiro || {};

window.Cancioneiro.preferencias = (function () {

	const DEFEITOS = {
		notacao: "anglo",
		idioma: "pt",
		mostrarAcordes: true   // ← novo, guardado em sessionStorage
	};

	// --- Preferências globais (localStorage) ---
	function carregar() {
		try {
			const guardado = localStorage.getItem("cancioneiro_prefs");
			return guardado ? { ...DEFEITOS, ...JSON.parse(guardado) } : { ...DEFEITOS };
		} catch {
			return { ...DEFEITOS };
		}
	}

	function guardar(prefs) {
		localStorage.setItem("cancioneiro_prefs", JSON.stringify(prefs));
	}

	let atual = carregar();

	function obter(chave) {
		// mostrarAcordes vive no sessionStorage
		if (chave === "mostrarAcordes") {
			const val = sessionStorage.getItem("mostrarAcordes");
			return val === null ? DEFEITOS.mostrarAcordes : val === "true";
		}
		return atual[chave];
	}

	function definir(chave, valor) {
		if (chave === "mostrarAcordes") {
			// O botão passa "true" ou "false" como string
			const valorBool = valor === true || valor === "true";
			sessionStorage.setItem("mostrarAcordes", String(valorBool));
		} else {
			atual[chave] = valor;
			guardar(atual);
		}
		document.dispatchEvent(new CustomEvent("preferencia-alterada", {
			detail: { chave, valor }
		}));
	}

	// --- Transposição por cântico (localStorage, chave única por id) ---
	function obterTransposicao(canticoId) {
		const val = localStorage.getItem(`transp_${canticoId}`);
		return val === null ? 0 : parseInt(val, 10);
	}
	
	function alterarTransposicao(canticoId, semitons) {
		const antigaTransp = obterTransposicao(canticoId);
		const novaTransp = (antigaTransp + semitons) % 12;
		
		// O JavaScript não diferencia estritamente 0 de -0 neste contexto, 
		// mas para limparmos corretamente, podemos tratar logo os dois casos:
        if (novaTransp === 0 || novaTransp === -0) {
			resetarTransposicao(canticoId);
			return;
		}

		// Guardar nova transposição e notificar mudanças
		localStorage.setItem(`transp_${canticoId}`, String(novaTransp));
		document.dispatchEvent(new CustomEvent("transposicao-alterada", {
			detail: { canticoId, semitons: novaTransp }
		}));
	}

	function resetarTransposicao(canticoId) {
		localStorage.removeItem(`transp_${canticoId}`);
		document.dispatchEvent(new CustomEvent("transposicao-alterada", {
			detail: { canticoId, semitons: 0 }
		}));
	}

	return {
		obter,
		definir,
		obterTransposicao,
		alterarTransposicao,
		resetarTransposicao
	};

})();