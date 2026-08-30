// painel.js — Carrega e injeta o painel partilhado em qualquer página

window.Cancioneiro = window.Cancioneiro || {};
window.Cancioneiro.painelPronto = false;

(async function () {
	try {
		const resposta = await fetch("painel.html");
		const html = await resposta.text();

		const container = document.createElement("div");
		container.innerHTML = html;
		document.body.appendChild(container);

		window.Cancioneiro.painelPronto = true;
		document.dispatchEvent(new CustomEvent("painel-pronto"));
	} catch (e) {
		console.error("Erro ao carregar o painel:", e);
	}
})();

function configurarPainelDefinicoes() {
	const painel = document.getElementById("painel-definicoes");
	const overlay = document.getElementById("overlay-definicoes");
	if (!painel || !overlay) return;

	const route = typeof getRoute === "function" ? getRoute() : { path: "/" };
	const ehFolha = route.path === "/folha";
	const ehCantico = route.path === "/cantico";

	function atualizarVisibilidadeOpcoes() {
		document.querySelectorAll("#painel-definicoes .folha, #painel-definicoes .cantico")
			.forEach((elemento) => {
				const pertenceFolha = elemento.classList.contains("folha");
				const pertenceCantico = elemento.classList.contains("cantico");

				const visivel = (pertenceFolha && ehFolha) || (pertenceCantico && ehCantico);
				elemento.style.display = visivel
					? (elemento.classList.contains("toggle") ? "flex" : "block")
					: "none";
			});
	}

	function abrirPainel() {
		const painel = document.getElementById("painel-definicoes");
		const overlay = document.getElementById("overlay-definicoes");
		if (!painel || !overlay) return;

		atualizarBotoes();
		atualizarVisibilidadeOpcoes();

		painel.classList.remove("painel-fechado");
		painel.classList.add("painel-aberto");
		overlay.classList.add("overlay-visivel");
	}

	function fecharPainel() {
		const painel = document.getElementById("painel-definicoes");
		const overlay = document.getElementById("overlay-definicoes");
		if (!painel || !overlay) return;

		painel.classList.remove("painel-aberto");
		painel.classList.add("painel-fechado");
		overlay.classList.remove("overlay-visivel");
	}

	function atualizarBotoes() {
		document.querySelectorAll(".opcao-toggle[data-pref][data-valor]").forEach((btn) => {
			const chave = btn.dataset.pref;
			const valor = btn.dataset.valor;
			const atual = Cancioneiro.preferencias.obter(chave);
			btn.classList.toggle("ativo", String(atual) === String(valor));
		});

		const toggleAdmin = document.getElementById("toggle-admin");
		const adminAutenticado = window.Cancioneiro.dbApi.isAdminAuthenticated();

		if (toggleAdmin) {
			toggleAdmin.checked = adminAutenticado;
		}

		if (adminAutenticado) {
			document.querySelectorAll(".admin").forEach((elemento) => {
				elemento.classList.remove("oculto");
			});
		} else {
			document.querySelectorAll(".admin").forEach((elemento) => {
				elemento.classList.add("oculto");
			});
		}

		const toggleFullscreen = document.getElementById("toggle-fullscreen");
		if (toggleFullscreen) {
			toggleFullscreen.checked = Boolean(document.fullscreenElement);
		}

		const estadoFolha = obterEstadoFolha();
		const toggleVerPaginas = document.getElementById("toggle-verPaginas");
		if (toggleVerPaginas) {
			toggleVerPaginas.checked = Boolean(estadoFolha.folha && estadoFolha.folha.verPaginas);
		}

		const toggleMeta = document.getElementById("toggle-meta");
		if (toggleMeta) {
			toggleMeta.checked = Boolean(estadoFolha.folha && estadoFolha.folha.ocultarMeta);
		}
	}

	// Evita múltiplos binds
	if (!painel.dataset.bindado) {
		painel.dataset.bindado = "true";

		document.addEventListener("click", (e) => {
			const abrir = e.target.closest("#btn-definicoes");
			if (abrir) {
				abrirPainel();
				return;
			}

			const fechar = e.target.closest("#btn-fechar-painel");
			if (fechar) {
				fecharPainel();
				return;
			}

			if (e.target === overlay) {
				fecharPainel();
			}
		});

		document.addEventListener("hashchange", () => {
			configurarPainelDefinicoes();
		});
	}

	atualizarVisibilidadeOpcoes();
	atualizarBotoes();

	// Eventos dos toggles (só uma vez)
	document.querySelectorAll(".opcao-toggle[data-pref][data-valor]").forEach((btn) => {
		btn.onclick = () => {
			const chave = btn.dataset.pref;
			const valor = btn.dataset.valor;
			Cancioneiro.preferencias.definir(chave, valor);
			atualizarBotoes();
		};
	});

	const toggleAdmin = document.getElementById("toggle-admin");
	if (toggleAdmin && !toggleAdmin.dataset.bindado) {
		toggleAdmin.dataset.bindado = "true";
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
	}

	const toggleFullscreen = document.getElementById("toggle-fullscreen");
	if (toggleFullscreen && !toggleFullscreen.dataset.bindado) {
		toggleFullscreen.dataset.bindado = "true";
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
	}

	const toggleVerPaginas = document.getElementById("toggle-verPaginas");
	if (toggleVerPaginas && !toggleVerPaginas.dataset.bindado) {
		toggleVerPaginas.dataset.bindado = "true";
		toggleVerPaginas.addEventListener("change", () => {
			const valor = Boolean(toggleVerPaginas.checked);
			const estadoFolha = obterEstadoFolha();
	
			if (estadoFolha && estadoFolha.folha) {
				estadoFolha.folha.verPaginas = valor;
			}
			if (estadoFolha) {
				estadoFolha.verPaginas = valor;
			}
	
			if (estadoFolha && estadoFolha.folha) {
				guardarPrefsLocais(estadoFolha.folha);
			}
	
			document.dispatchEvent(new CustomEvent("preferencia-alterada", {
				detail: {
					chave: "verPaginas",
					valor: valor
				}
			}));
		});
	}

	const toggleMeta = document.getElementById("toggle-meta");
	if (toggleMeta && !toggleMeta.dataset.bindado) {
		toggleMeta.dataset.bindado = "true";
		toggleMeta.addEventListener("change", () => {
			const estadoFolha = obterEstadoFolha();

			if (estadoFolha && estadoFolha.folha) {
				estadoFolha.folha.ocultarMeta = valor;
			}
			if (estadoFolha) {
				estadoFolha.ocultarMeta = valor;
			}
	
			if (estadoFolha && estadoFolha.folha) {
				guardarPrefsLocais(estadoFolha.folha);
			}

			document.dispatchEvent(new CustomEvent("preferencia-alterada", {
				detail: {
					chave: "ocultarMeta",
					valor: toggleMeta.checked
				}
			}));
		});
	}

	const btnNovoCantico = document.getElementById("btn-novo-cantico");
	if (btnNovoCantico && !btnNovoCantico.dataset.bindado) {
		btnNovoCantico.dataset.bindado = "true";
		btnNovoCantico.addEventListener("click", () => {
			if (window.Cancioneiro.dbApi.isAdminAuthenticated()) {
				navigate("/editor-cantico");
			} else {
				alert("Apenas administradores podem criar novos cânticos");
			}
		});
	}
}

document.addEventListener("painel-pronto", configurarPainelDefinicoes);
document.addEventListener("hashchange", configurarPainelDefinicoes);