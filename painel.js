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
	const btnAdmin = document.getElementById("btn-admin");
	const btnFullscreen = document.getElementById("btn-fullscreen");

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

	// Lógica do botão admin
	btnAdmin.addEventListener("click", async () => {
		if (window.Cancioneiro.dbApi.isAdminAuthenticated()) {
			await window.Cancioneiro.dbApi.logoutAdmin();
		}
		else {
			await window.Cancioneiro.dbApi.authAdmin();
		}
		atualizarBotoes();
	});

	// Lógica do botão novo cântico
	const btnNovoCantico = document.getElementById("btn-novo-cantico");
	if (btnNovoCantico) {
		btnNovoCantico.addEventListener("click", () => {
			if (window.Cancioneiro.dbApi.isAdminAuthenticated()) {
				window.location.href = "editor-cantico.html";
			} else {
				alert("Apenas administradores podem criar novos cânticos");
			}
		});
	}

	// Lógica do botão fullscreen
	btnFullscreen.addEventListener("click", async () => {
		try {
			if (!document.fullscreenElement) {
				// Solicita fullscreen
				const elem = document.documentElement;

				if (elem.requestFullscreen) {
					await elem.requestFullscreen();
				} else if (elem.webkitRequestFullscreen) {
					// Safari e versões antigas de Chrome
					await elem.webkitRequestFullscreen();
				} else if (elem.msRequestFullscreen) {
					// IE 11
					await elem.msRequestFullscreen();
				} else if (elem.mozRequestFullScreen) {
					// Firefox
					await elem.mozRequestFullScreen();
				}
			} else {
				// Sai de fullscreen
				if (document.exitFullscreen) {
					await document.exitFullscreen();
				} else if (document.webkitExitFullscreen) {
					await document.webkitExitFullscreen();
				} else if (document.msExitFullscreen) {
					await document.msExitFullscreen();
				} else if (document.mozCancelFullScreen) {
					await document.mozCancelFullScreen();
				}
			}
			atualizarBotoes();
		} catch (e) {
			console.error("Erro ao alternar fullscreen:", e);
		}
	});

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

        // --- Admin ---
		if (window.Cancioneiro.dbApi.isAdminAuthenticated()) {
			btnAdmin.textContent = "Admin: ON";
		} else {
			btnAdmin.textContent = "Admin: OFF";
		}

		// --- Fullscreen ---
		if (document.fullscreenElement) {
			btnFullscreen.textContent = "Fullscreen: ON";
			btnFullscreen.classList.add("ativo");
		} else {
			btnFullscreen.textContent = "Fullscreen: OFF";
			btnFullscreen.classList.remove("ativo");
		}
	}

	atualizarBotoes();
});