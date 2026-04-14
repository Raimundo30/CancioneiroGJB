<<<<<<< HEAD
// folhas.js — Gestão de folhas de cânticos no localStorage

window.Cancioneiro = window.Cancioneiro || {};

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

	const CHAVE_STORAGE = "cancioneiro_folhas";

	function carregarTodas() {
		try {
			const guardado = localStorage.getItem(CHAVE_STORAGE);
			return guardado ? JSON.parse(guardado) : [];
		} catch {
			return [];
		}
	}

	function guardarTodas(folhas) {
		localStorage.setItem(CHAVE_STORAGE, JSON.stringify(folhas));
	}

	function gerarId() {
		return "f" + Date.now().toString(36);
	}

	function listar() {
		return carregarTodas();
	}

	function obter(id) {
		return carregarTodas().find(f => f.id === id) || null;
	}

	function criar(titulo, data, notas) {
		const folhas = carregarTodas();
		const novaFolha = {
			id: gerarId(),
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
		listar,
		obter,
		criar,
		guardar,
		apagar,
		adicionarCantico,
		removerCantico,
		obterMomentosBase
	};

=======
// folhas.js — Gestão de folhas de cânticos no localStorage

window.Cancioneiro = window.Cancioneiro || {};

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

	const CHAVE_STORAGE = "cancioneiro_folhas";

	function carregarTodas() {
		try {
			const guardado = localStorage.getItem(CHAVE_STORAGE);
			return guardado ? JSON.parse(guardado) : [];
		} catch {
			return [];
		}
	}

	function guardarTodas(folhas) {
		localStorage.setItem(CHAVE_STORAGE, JSON.stringify(folhas));
	}

	function gerarId() {
		return "f" + Date.now().toString(36);
	}

	function listar() {
		return carregarTodas();
	}

	function obter(id) {
		return carregarTodas().find(f => f.id === id) || null;
	}

	function criar(titulo, data, notas) {
		const folhas = carregarTodas();
		const novaFolha = {
			id: gerarId(),
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
		listar,
		obter,
		criar,
		guardar,
		apagar,
		adicionarCantico,
		removerCantico,
		obterMomentosBase
	};

>>>>>>> 6ca9708 (Ligação Git)
})();