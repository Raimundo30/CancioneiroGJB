// Router.js

function getRoute() {
	const hash = location.hash || "#/";
	const [path, query = ""] = hash.replace(/^#/, "").split("?");
	return {
		path: path || "/",
		params: new URLSearchParams(query)
	};
}
	
function navigate(path, params = {}) {
	const query = new URLSearchParams(params).toString();
	location.hash = `#${path}${query ? `?${query}` : ""}`;
}

function resolveRoute() {
	const { path, params } = getRoute();
	const id = params.get("id");

	switch (path) {
		case "/":
			renderHome();
			break;

		case "/folha":
			renderFolha(id);
			break;

		case "/cantico":
			renderCantico(id);
			break;

		case "/editor-folha":
			renderEditorFolha(id);
			break;

		case "/editor-cantico":
			renderEditorCantico(id);
			break;

		default:
			renderHome();
	}
}

window.addEventListener("DOMContentLoaded", () => {
	resolveRoute();
	window.addEventListener("hashchange", resolveRoute);
});