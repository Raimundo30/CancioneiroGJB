window.Cancioneiro = window.Cancioneiro || {};

window.Cancioneiro.partilha = (function () {
	// Função auxiliar para procurar as secções originais num cântico via fetch
	async function obterSeccoesOriginais(canticoId) {
		try {
			const res = await fetch(`dados/${canticoId}.cho`);
			if (!res.ok) return [];
			const txt = await res.text();
			const parsed = Cancioneiro.parser.parse(txt);
			return parsed.seccoes.map(s => s.titulo);
		} catch (e) {
			return [];
		}
	}

	async function codificar(folha) {
		const strPartes = [folha.titulo || "Folha"];

		for (const mo of folha.momentos) {
			if (!mo.canticos || mo.canticos.length === 0) continue;

			let mStr = `${mo.label}=`;
			const arrCanticos = [];

			for (const c of mo.canticos) {
				const tom = c.tom || 0;
				let binario = "1"; // "1" significa mostrar todas as secções

				if (c.seccoes && c.seccoes.length > 0) {
					const originais = await obterSeccoesOriginais(c.canticoId);
					if (originais.length > 0) {
						// Cria string binária: "101" onde 1 é incluído, 0 excluído
						binario = originais.map(s => c.seccoes.includes(s) ? "1" : "0").join("");
						// Se for só "1"s (tudo selecionado), simplifica para "1"
						if (!binario.includes("0")) binario = "1";
					}
				}
				arrCanticos.push(`${c.canticoId}$${tom}$${binario}`);
			}

			mStr += arrCanticos.join("&");
			strPartes.push(mStr);
		}

		return encodeURIComponent(strPartes.join("*"));
	}

	async function descodificar(codigo) {
		try {
			const strDesc = decodeURIComponent(codigo);
			if (strDesc.startsWith("{")) return JSON.parse(strDesc); // Retrocompatibilidade clássica

			const partes = strDesc.split("*");
			const momentos = [];

			for (let i = 1; i < partes.length; i++) {
				const blocoMo = partes[i].split("=");
				if (blocoMo.length !== 2) continue;

				const moLabel = blocoMo[0];
				const moId = moLabel.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '-');
				const arrCanticos = blocoMo[1] ? blocoMo[1].split("&") : [];
				const canticosParsed = [];

				for (const strC of arrCanticos) {
					const [cId, cTom, cSec] = strC.split("$");
					let seccoesEscolhidas = null;

					// Se for código binário (ex: "101"), mapeia para os nomes das secções originais
					if (cSec !== "1") {
						const originais = await obterSeccoesOriginais(cId);
						seccoesEscolhidas = [];
						for (let idx = 0; idx < cSec.length; idx++) {
							if (cSec[idx] === "1" && originais[idx]) {
								seccoesEscolhidas.push(originais[idx]);
							}
						}
					}

					canticosParsed.push({
						canticoId: cId,
						tom: parseInt(cTom, 10) || 0,
						seccoes: seccoesEscolhidas,
						notas: ""
					});
				}

				momentos.push({ id: moId, label: moLabel, canticos: canticosParsed });
			}

			return {
				id: "partilha", editar: false, titulo: partes[0], data: "", notas: "", verPaginas: false,
				momentos: momentos
			};
		} catch (e) {
			console.error("Erro a descodificar folha:", e);
			return null;
		}
	}

	return {
		codificar,
		descodificar
	};
})();