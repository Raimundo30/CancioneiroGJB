// folhas.js — Gestão de folhas de cânticos no localStorage

window.Cancioneiro = window.Cancioneiro || {};

window.Cancioneiro.estadoFolha = window.Cancioneiro.estadoFolha || {
	folha: null,
	indice: [],
	canticosCache: {},
	momentoAtivo: 0,
	verPaginas: false,
	ocultarMeta: false
};

function obterEstadoFolha() {
	return window.Cancioneiro.estadoFolha;
}

window.Cancioneiro.folhas = (function () {

	const MOMENTOS_BASE = [
	{ id: "entrada",             label: "Entrada" },
	{ id: "ato-penitencial",     label: "Ato Penitencial" },
	{ id: "aclamacao-evangelho", label: "Aclamação do Evangelho" },
	{ id: "ofertorio",           label: "Ofertório" },
	{ id: "santo",               label: "Santo" },
	{ id: "cordeiro",            label: "Cordeiro" },
	{ id: "comunhao",            label: "Comunhão" },
	{ id: "acao-gracas",         label: "Ação de Graças" },
	{ id: "final",               label: "Final" }
	];

	const KEY_PRIVADAS = "folhas_privadas";
	const KEY_PARTILHADAS = "folhas_partilhadas";

	function carregarTodas() {
		try {
			const guardado = localStorage.getItem(KEY_PRIVADAS);
			return guardado ? JSON.parse(guardado) : [];
		} catch {
			return [];
		}
	}

	function guardarTodas(folhas) {
		localStorage.setItem(KEY_PRIVADAS, JSON.stringify(folhas));
	}

	function gerarId() {
		return "f" + ([1e7] + -1e3 + -4e3 + -8e3 + -1e11)
			.replace(/[018]/g, c =>
				(c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
			);
	}

	function listar() {
		// DEBUG DEVIDO A UPDATE: Migra folhas antigas e normaliza tipo: "privada"
		const folhasAntigas = localStorage.getItem("cancioneiro_folhas");
		if (folhasAntigas) {
			const parsedAntigas = JSON.parse(folhasAntigas).map(f => ({
				...f,
				tipo: "privada"
			}));

			// Carregar as que já existem em KEY_PRIVADAS
			const existentes = localStorage.getItem(KEY_PRIVADAS);
			const parsedExistentes = existentes ? JSON.parse(existentes) : [];

			// Fazer MERGE (juntar) em vez de sobrescrever
			const merged = [...parsedExistentes, ...parsedAntigas];
			localStorage.setItem(KEY_PRIVADAS, JSON.stringify(merged));
			localStorage.removeItem("cancioneiro_folhas");
		}
		// FIM DO DEBUG

		// Carregar privadas e normalizar
		const guardado_privado = localStorage.getItem(KEY_PRIVADAS);
		const parsed_privado = guardado_privado ? JSON.parse(guardado_privado) : [];
		const lista_privada = parsed_privado.map(f => ({
			...f,
			tipo: "privada"
		}));

		// Carregar partilhadas
		const guardado_partilhado = localStorage.getItem(KEY_PARTILHADAS);
		const lista_partilhada = guardado_partilhado ? JSON.parse(guardado_partilhado).map(f => f) : [];

		return {
			privada: lista_privada,
			partilhada: lista_partilhada
		};
	}

	function obter(id) {
		return carregarTodas().find(f => f.id === id) || null;
	}

	function criar(titulo, data, notas) {
		const folhas = carregarTodas();
		const novaFolha = {
			id: gerarId(),
            tipo: "privada",
			titulo: titulo || "Nova folha",
			data: data || "",
			notas: notas || "",
			momentos: MOMENTOS_BASE.map(m => ({
				id: m.id,
				label: m.label,
				canticos: []
			}))
		};
		folhas.push(novaFolha);
		guardarTodas(folhas);
		return novaFolha;
	}

	function guardar(folhaAtualizada) {
		const folhas = carregarTodas();
		const indice = folhas.findIndex(f => f.id === folhaAtualizada.id);
		if (indice === -1) return false;
		folhas[indice] = folhaAtualizada;
		guardarTodas(folhas);
		return true;
	}

	function apagar(id) {
		guardarTodas(carregarTodas().filter(f => f.id !== id));
	}

	function adicionarCantico(folhaId, momentoId, canticoId) {
		const folhas  = carregarTodas();
		const folha   = folhas.find(f => f.id === folhaId);
		if (!folha) return false;

		const momento = folha.momentos.find(m => m.id === momentoId);
		if (!momento) return false;

		if (momento.canticos.some(c => c.canticoId === canticoId)) return false;

		momento.canticos.push({
			canticoId,
			seccoes: null,
			tom: null,
			notas: ""
		});

		guardarTodas(folhas);
		return true;
	}

	function removerCantico(folhaId, momentoId, canticoId) {
		const folhas  = carregarTodas();
		const folha   = folhas.find(f => f.id === folhaId);
		if (!folha) return false;

		const momento = folha.momentos.find(m => m.id === momentoId);
		if (!momento) return false;

		momento.canticos = momento.canticos.filter(c => c.canticoId !== canticoId);
		guardarTodas(folhas);
		return true;
	}

	function obterMomentosBase() {
		return [...MOMENTOS_BASE];
	}

	return {
		KEY_PRIVADAS: KEY_PRIVADAS,
        KEY_PARTILHADAS: KEY_PARTILHADAS,
		listar,
		obter,
		criar,
		guardar,
		apagar,
		adicionarCantico,
		removerCantico,
		obterMomentosBase
	};

})();


async function carregarIndice() {
	return await window.Cancioneiro.dbApi.carregarIndice();
}

async function carregarCantico(canticoId) {
	const estadoFolha = obterEstadoFolha();

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
	const estadoFolha = obterEstadoFolha();

	if (estadoFolha.folha.tipo === "privada") {
		window.Cancioneiro.folhas.guardar(estadoFolha.folha);
		return;
	}

	try {
		return await window.Cancioneiro.dbApi.atualizarFolha(estadoFolha.folha);
	} catch (e) {
		console.error("Erro a atualizar folha partilhada:", e);
		return false;
	}
}