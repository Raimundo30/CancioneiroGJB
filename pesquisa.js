window.Cancioneiro = window.Cancioneiro || {};

window.Cancioneiro.Pesquisa = class Pesquisa {
	constructor(container, indice, aoSelecionar, opcoes = {}) {
		this.container = typeof container === 'string' ? document.getElementById(container) : container;
		this.indice = indice;
		this.aoSelecionar = aoSelecionar;
		this.termo = "";
		this.categoriasAtivas = new Set();

		this.todasCategorias = new Set();
		this.indice.forEach(c => c.categorias?.forEach(cat => this.todasCategorias.add(cat)));
		this.categoriasOrd = Array.from(this.todasCategorias).sort();

		this.renderizarEstrutura();
		this.ligarEventos();
		this.renderizarLista();
	}

	renderizarEstrutura() {
		this.container.innerHTML = `
			<div class="pesquisa-wrapper">
				<input type="text" class="pesquisa-input" placeholder="Pesquisar por título, autor ou categoria...">
				<div class="pesquisa-filtros"></div>
				<ul class="pesquisa-lista"></ul>
			</div>
		`;
		this.input = this.container.querySelector('.pesquisa-input');
		this.lista = this.container.querySelector('.pesquisa-lista');
		this.renderizarFiltros();
	}

	renderizarFiltros() {
		const fContainer = this.container.querySelector('.pesquisa-filtros');
		
		let html = `<button class="filtro-btn ${this.categoriasAtivas.size === 0 ? 'ativo' : ''}" data-acao="limpar">Todos</button>`;
		
		this.categoriasAtivas.forEach(cat => {
			html += `<button class="filtro-btn ativo" data-acao="remover" data-categoria="${cat}">${cat} ✕</button>`;
		});

		const disponiveis = this.categoriasOrd.filter(cat => !this.categoriasAtivas.has(cat));
		
		if (disponiveis.length > 0) {
			html += `
			<div class="filtro-dropdown-container">
				<button class="filtro-btn filtro-mais">...</button>
				<div class="filtro-dropdown dropdown oculto" style="max-height: 250px; overflow-y: auto;">
					${disponiveis.map(cat => `<div class="filtro-drop-item" data-acao="adicionar" data-categoria="${cat}">${cat}</div>`).join('')}
				</div>
			</div>`;
		}

		fContainer.innerHTML = html;
		this.filtros = fContainer;
		this.btnMais = fContainer.querySelector('.filtro-mais');
		this.dropdown = fContainer.querySelector('.filtro-dropdown');
	}

	ligarEventos() {
		this.input.addEventListener("input", () => {
			this.termo = this.input.value.toLowerCase();
			this.renderizarLista();
		});

		this.filtros.addEventListener("click", (e) => {
			if (e.target.classList.contains('filtro-mais')) {
				if (this.dropdown) this.dropdown.classList.toggle('oculto');
				return;
			}

			const acao = e.target.dataset.acao;
			if (!acao) return;

			if (acao === 'limpar') {
				this.categoriasAtivas.clear();
			} else if (acao === 'adicionar') {
				this.categoriasAtivas.add(e.target.dataset.categoria);
			} else if (acao === 'remover') {
				this.categoriasAtivas.delete(e.target.dataset.categoria);
			}

			this.renderizarFiltros();
			this.renderizarLista();
		});

		document.addEventListener('click', (e) => {
			if (this.dropdown && !this.dropdown.contains(e.target) && e.target !== this.btnMais) {
				this.dropdown.classList.add('oculto');
			}
		});
	}

	renderizarLista() {
		this.lista.innerHTML = "";
		const filtrados = this.indice.filter(c => {
			const titulo = (c.titulo || c.title || "").toLowerCase();
			const autor = (c.autor || "").toLowerCase();
			const subtitulo = (c.subtitulo || c.subtitle || "").toLowerCase();
			
			const matchTexto = !this.termo ||
				titulo.includes(this.termo) ||
				autor.includes(this.termo) ||
				subtitulo.includes(this.termo) ||
				(c.categorias || []).some(cat => cat.toLowerCase().includes(this.termo));
				
			let matchContagem = 0;
            if (this.categoriasAtivas.size > 0) {
                matchContagem = (c.categorias || []).filter(cat => this.categoriasAtivas.has(cat)).length;
                // Se houverem filtros ativos, tem de corresponder a pelo menos um
                if (matchContagem === 0) return false;
            }
            
            if (matchTexto) {
                c._matchContagem = matchContagem; // Guarda o número de correspondências para a ordenação
                return true;
            }
            return false;
        });

        // Ordena primeiro pelos que têm mais categorias correspondentes (todos > alguns) e depois alfabeticamente
        filtrados.sort((a, b) => {
            if (b._matchContagem !== a._matchContagem) {
                return b._matchContagem - a._matchContagem;
            }
            const tituloA = (a.titulo || a.title || "").toLowerCase();
            const tituloB = (b.titulo || b.title || "").toLowerCase();
            return tituloA.localeCompare(tituloB);
        });

		if (filtrados.length === 0) {
			this.lista.innerHTML = "<li class='pesquisa-vazio'>Nenhum cântico encontrado.</li>";
			return;
		}

		const notacao = (Cancioneiro.preferencias && Cancioneiro.preferencias.obter) 
			? Cancioneiro.preferencias.obter("notacao") 
			: "anglo";

		filtrados.forEach(cantico => {
			const tomApresentado = notacao === "latino" && Cancioneiro.parser
				? Cancioneiro.parser.converterAcorde(cantico.tom, "latino")
				: cantico.tom;

			const li = document.createElement("li");
			li.className = "pesquisa-item";
			li.id = "pesquisa-item-" + cantico.id;
			
			li.innerHTML = `
				<div class="pesquisa-info">
					<span class="pesquisa-titulo">${cantico.titulo}  ${cantico.subtitulo ? '(' + cantico.subtitulo + ')' : ''}</span>
					<span class="pesquisa-meta">
						${(cantico.autor) ? cantico.autor + ' · ' : ''}										<!-- Pode não ter autor      -->
						Tom: ${tomApresentado}																<!-- Tem sempre tom          -->
						${cantico.categorias.length > 0 ? ' · ' + cantico.categorias.sort().join(", ") : ''}		<!-- Pode não ter categorias -->
					</span>
				</div>
			`;
			li.addEventListener("click", () => this.aoSelecionar(cantico));
			this.lista.appendChild(li);
		});
	}
};