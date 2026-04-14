// painel.js — Carrega e injeta o painel partilhado em qualquer página

window.Cancioneiro = window.Cancioneiro || {};
window.Cancioneiro.painelPronto = false;

(async function () {
	try {
		const resposta = await fetch("painel.html");
		const html     = await resposta.text();

		const container = document.createElement("div");
		container.innerHTML = html;
		document.body.appendChild(container);

		window.Cancioneiro.painelPronto = true;
		document.dispatchEvent(new CustomEvent("painel-pronto"));

		// Inicializa a secção de folhas
		Cancioneiro.painelFolhas.init();
	} catch (e) {
		console.error("Erro ao carregar o painel:", e);
	}
})();