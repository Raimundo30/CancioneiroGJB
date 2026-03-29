// definicoes.js — Lógica do painel de definições

document.addEventListener("painel-pronto", () => {
	const painel = document.getElementById("painel-definicoes");
	const overlay = document.getElementById("overlay-definicoes");
	const btnAbrir = document.getElementById("btn-definicoes");
	const btnFechar = document.getElementById("btn-fechar-painel");

	function abrirPainel() {
		painel.classList.remove("painel-fechado");
		painel.classList.add("painel-aberto");
		overlay.classList.add("overlay-visivel");
	}

	function fecharPainel() {
		painel.classList.remove("painel-aberto");
		painel.classList.add("painel-fechado");
		overlay.classList.remove("overlay-visivel");
	}

	btnAbrir.addEventListener("click", abrirPainel);
	btnFechar.addEventListener("click", fecharPainel);
	overlay.addEventListener("click", fecharPainel);

	// Lógica dos botões de toggle
	document.querySelectorAll(".opcao-toggle").forEach(btn => {
		btn.addEventListener("click", () => {
			const chave = btn.dataset.pref;
			const valor = btn.dataset.valor;
			Cancioneiro.preferencias.definir(chave, valor);
			atualizarBotoes();
		});
	});

	// Sincroniza o visual dos botões com as preferências atuais
	function atualizarBotoes() {
		document.querySelectorAll(".opcao-toggle[data-pref][data-valor]").forEach(btn => {
			const chave = btn.dataset.pref;
			const valor = btn.dataset.valor;
			btn.classList.toggle("ativo", Cancioneiro.preferencias.obter(chave) === valor);
		});
	}

	atualizarBotoes();
});