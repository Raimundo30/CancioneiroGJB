// app.js — Lógica da página principal (lista de cânticos)

async function carregarCanticos() {
	const resposta = await fetch("dados/index.json");
	const canticos = await resposta.json();
	return canticos;
}

function renderizarLista(canticos) {
	const lista = document.getElementById("lista-canticos");
	lista.innerHTML = "";

	if (canticos.length === 0) {
		lista.innerHTML = "<li>Nenhum cântico encontrado.</li>";
		return;
	}

	// Lê a preferência atual aqui dentro, para usar sempre o valor mais recente
	const notacao = Cancioneiro.preferencias.obter("notacao");

	for (const cantico of canticos) {
		// Converte o tom conforme a notação escolhida
		const tomApresentado = notacao === "latino"
			? Cancioneiro.parser.converterAcorde(cantico.tom, "latino")
			: cantico.tom;

		const li = document.createElement("li");

		li.innerHTML = `
			<div class="cantico-titulo">${cantico.titulo} ${cantico.subtitulo ? '(' + cantico.subtitulo + ')' : ''}</div>
			<div class="cantico-meta">${cantico.autor} · Tom: ${tomApresentado} · ${cantico.categorias.join(", ")}</div>
		`;

		li.addEventListener("click", () => {
			window.location.href = `cantico.html?id=${cantico.id}`;
		});

		lista.appendChild(li);
		}
}

function filtrarCanticos(canticos, pesquisa) {
	const termo = pesquisa.toLowerCase();
	return canticos.filter(c =>
		c.titulo.toLowerCase().includes(termo) ||
		c.autor.toLowerCase().includes(termo) ||
		c.categorias.some(cat => cat.toLowerCase().includes(termo))
	);
}

// Inicialização
async function init() {
	const todosCanticos = await carregarCanticos();

	// Renderiza a lista completa ao carregar
	renderizarLista(todosCanticos);

	// Filtra à medida que o utilizador escreve
	document.getElementById("pesquisa").addEventListener("input", (e) => {
		const filtrados = filtrarCanticos(todosCanticos, e.target.value);
		renderizarLista(filtrados);
	});

	// Escuta mudanças nas preferências
	document.addEventListener("preferencia-alterada", () => {
		const filtrados = filtrarCanticos(todosCanticos,
			document.getElementById("pesquisa").value);
		renderizarLista(filtrados);
	});
}

init();