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

	// Determinar se estamos numa página de folha ou de cântico
	const ehFolha = window.location.pathname
        .toLowerCase()
        .endsWith("folha.html");

    const ehCantico = window.location.pathname
        .toLowerCase()
        .endsWith("cantico.html");

    function configurarVisibilidadeOpcoes() {
		document.querySelectorAll("#painel-definicoes .folha, #painel-definicoes .cantico")
		.forEach(elemento => {
			const pertenceFolha = elemento.classList.contains("folha");
			const pertenceCantico = elemento.classList.contains("cantico");

			const visivel = (pertenceFolha && ehFolha) || (pertenceCantico && ehCantico);

			elemento.style.display = visivel
				? elemento.classList.contains("toggle") ? "flex" : "block"
				: "none";
		});
    }
	configurarVisibilidadeOpcoes();

	// Lógica do botão abrir
	const btnAbrir = document.getElementById("btn-definicoes");
	btnAbrir.addEventListener("click", abrirPainel);
	function abrirPainel() {
		atualizarBotoes();
		painel.classList.remove("painel-fechado");
		painel.classList.add("painel-aberto");
		overlay.classList.add("overlay-visivel");
	}
	
	// Lógica do botão fechar
	const btnFechar = document.getElementById("btn-fechar-painel");
	btnFechar.addEventListener("click", fecharPainel);
	overlay.addEventListener("click", fecharPainel);
	function fecharPainel() {
		painel.classList.remove("painel-aberto");
		painel.classList.add("painel-fechado");
		overlay.classList.remove("overlay-visivel");
	}

	// Lógica do botão admin
	const toggleAdmin = document.getElementById("toggle-admin");
	toggleAdmin.addEventListener("click", async () => {
		if (toggleAdmin.checked) {
			const resultado = await window.Cancioneiro.dbApi.authAdmin();
	
			if (!resultado.sucesso) {
				toggleAdmin.checked = false;
			}
		} else {
			await window.Cancioneiro.dbApi.logoutAdmin();
		}
		atualizarBotoes();
	});

	// Lógica do botão novo cântico (apenas visível para admins)
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

	// Lógica do botão apagar cântico (apenas visível para admins)
	const btnApagarCantico = document.getElementById("btn-apagar-cantico");
	if (btnApagarCantico) {
		// btnApagarCantico.addEventListener("click", async () => {
		// 	if (window.Cancioneiro.dbApi.isAdminAuthenticated()) {
		// 		const confirmacao = confirm("Tem certeza que deseja apagar este cântico?");
		// 		if (confirmacao) {
		// 			await window.Cancioneiro.dbApi.apagarCantico();
		// 		}
		// 	} else {
		// 		alert("Apenas administradores podem apagar cânticos");
		// 	}
		// });
	}

	// Lógica do botão fullscreen
	const toggleFullscreen = document.getElementById("toggle-fullscreen");
	toggleFullscreen.addEventListener("change", async () => {
		try {
			if (toggleFullscreen.checked) {
				await document.documentElement.requestFullscreen();
			} else if (document.fullscreenElement) {
				await document.exitFullscreen();
			}
		} catch (erro) {
			console.error("Erro ao alternar fullscreen:", erro);
			toggleFullscreen.checked = Boolean(document.fullscreenElement);
		}
	
		atualizarBotoes();
	});

	// Lógica do botão "Ver por página" (apenas visível em folhas)
	const toggleVerPaginas = document.getElementById("toggle-verPaginas");
	if (toggleVerPaginas) {
        toggleVerPaginas.addEventListener("change", () => {
            document.dispatchEvent(new CustomEvent("folha-preferencia-alterada", {
                detail: {
                    chave: "verPaginas",
                    valor: toggleVerPaginas.checked
                }
            }));
        });
    }

	// Lógica do botão "Ocultar meta" (apenas visível em folhas)
	const toggleMeta = document.getElementById("toggle-meta");
    if (toggleMeta) {
        toggleMeta.addEventListener("change", () => {
            document.dispatchEvent(new CustomEvent("folha-preferencia-alterada", {
                detail: {
                    chave: "ocultarMeta",
                    valor: toggleMeta.checked
                }
            }));
        });
    }

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

			btn.classList.toggle("ativo", String(atual) === String(valor));
		});

		// --- Admin ---
		const adminAutenticado = window.Cancioneiro.dbApi.isAdminAuthenticated();

		toggleAdmin.checked = adminAutenticado;
		document.querySelectorAll("#novo-cantico, #apagar-cantico").forEach(elemento => {
			elemento.style.display = adminAutenticado &&
			(
				(elemento.id === "novo-cantico" && (ehFolha || ehCantico)) ||
				(elemento.id === "apagar-cantico" && ehCantico)
			)
				? "block"
				: "none";
		});

		// --- Fullscreen ---
		toggleFullscreen.checked = Boolean(document.fullscreenElement);
	}

	atualizarBotoes();
});