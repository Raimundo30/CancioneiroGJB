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
	} catch (e) {
		console.error("Erro ao carregar o painel:", e);
	}
})();

// Lógica do painel de definições

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
            const atual = Cancioneiro.preferencias.obter(chave);
            // Compara como string para suportar booleanos guardados como "true"/"false"
            btn.classList.toggle("ativo", String(atual) === String(valor));
        });
    }

    atualizarBotoes();
});