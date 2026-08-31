// arquivo: componentes.js


// Componente de navegação (usado em /cantico e /folha)
class NavComp extends HTMLElement {
	connectedCallback() {
		this.innerHTML = `
			<div id="nav-comp-inner">
				<!-- Botões de navegação -->
				<button id="btn-anterior" title="Cântico anterior"  >‹</button>
				<button id="btn-indice"   title="Índice de cânticos">≡</button>
				<button id="btn-seguinte" title="Cântico seguinte"  >›</button>
			</div>
		`;
	}
}
customElements.define('nav-comp', NavComp);

// Componente de transposição (usado em /cantico e /folha)
class TranspComp extends HTMLElement {
	connectedCallback() {
		if (this.dataset.ready === "true") return;
		this.dataset.ready = "true";
		
		this.innerHTML = `
			<div id="transp-comp-inner">
				<!-- Botões de transposição -->
				<button id="btn-transp-menos">−</button>
				<span   id="spn-transp-valor">...</span>
				<button id="btn-transp-mais">+</button>
				<button id="btn-transp-reset" class="btn-texto">Repor</button>
			</div>
		`;
	}

	// Renderiza botão de Reset
	// const btnReset = document.getElementById("btn-transp-reset");
	// const btnReset = document.querySelector("#COMPONENT-ID #btn-transp-reset");
	// btnReset.disabled = semitons === 0;
}
customElements.define('transp-comp', TranspComp);