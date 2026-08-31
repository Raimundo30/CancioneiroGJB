// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-app.js";
import { getFirestore, collection, getDocs, doc, getDoc, updateDoc, deleteDoc, addDoc, setDoc, runTransaction, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-analytics.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-auth.js";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
	apiKey: "AIzaSyASNaUeakhEr2mAB2cLZ1ufGkHrm0lHbYM",
	authDomain: "cancioneirogjb.firebaseapp.com",
	projectId: "cancioneirogjb",
	storageBucket: "cancioneirogjb.firebasestorage.app",
	messagingSenderId: "569511586127",
	appId: "1:569511586127:web:c9cff6ec41b17851f13d3a",
	measurementId: "G-1WRP9RXLEM"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const analytics = getAnalytics(app);
const auth = getAuth(app);

// Expor a base de dados para ser usada pelo app.js, cantico.js, folhas.js, etc.
window.Cancioneiro = window.Cancioneiro || {};
window.Cancioneiro.db = db;
window.Cancioneiro.auth = auth;

// --- MAPA DE COLECÇÕES POR TIPO DE FOLHA ---
const TIPOS_FOLHAS = {
	privada: "folhas-privadas",
	partilhada: "folhas-partilhadas",
	publica: "folhas-publicas"
};

// --- HASHING ---
const AuthUtils = {
	/**
	 * Gera um hash SHA-256 do código + salt
	 */
	hashCodigo: async function (codigo, salt) {
		const encoder = new TextEncoder();
		const data = encoder.encode(codigo + salt);
		const hashBuffer = await crypto.subtle.digest('SHA-256', data);
		const hashArray = Array.from(new Uint8Array(hashBuffer));
		return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
	},

	/**
	 * Gera um salt aleatório (16 caracteres)
	 */
	gerarSalt: function () {
		return Array.from(crypto.getRandomValues(new Uint8Array(8)))
			.map(b => b.toString(16).padStart(2, '0'))
			.join('');
	},

	/**
	 * Valida um código comparando com o hash armazenado
	 */
	validarCodigo: async function (codigoIntroduzido, hashArmazenado, salt) {
		const hashCalculado = await this.hashCodigo(codigoIntroduzido, salt);
		return hashCalculado === hashArmazenado;
	}
};

// --- NOVAS FUNÇÕES GLOBAIS DE BASE DE DADOS ---

window.Cancioneiro.dbApi = {

	// ===== Funções para cânticos =====

	carregarIndice: async function () {
		const querySnapshot = await getDocs(collection(db, "canticos"));
		const indice = [];
		querySnapshot.forEach((docSnap) => {
			const data = docSnap.data();
			indice.push({
				id: docSnap.id,
				titulo: data.titulo,
				subtitulo: data.subtitulo,
				autor: data.autor,
				tom: data.tom,
				categorias: data.categorias || []
			});
		});
		return indice;
	},

	carregarCantico: async function(id) {
		const docRef = doc(db, "canticos", id);
		const docSnap = await getDoc(docRef);
		if (docSnap.exists()) {
			return docSnap.data();
		}
		return null;
	},

	criarCantico: async function (canticoData) {
		// FALTA gerar ID unico com base no titulo, subtitulo e outros canticos existentes para evitar duplicados
		const docRef = await addDoc(collection(db, "canticos"), canticoData);
		return docRef.id;
	},

	apagarCantico: async function (id) {
		try {
			const docRef = doc(db, "canticos", id);
			const binRef = doc(db, "bin-canticos", id); // Mantém o MESMO ID na reciclagem

			await runTransaction(db, async (transaction) => {
				const docSnap = await transaction.get(docRef);
				
				if (!docSnap.exists()) {
					throw new Error("O cântico não existe.");
				}
	
				const canticoData = docSnap.data();
	
				// 1. Movel para a reciclagem preservando o ID e adicionando a data de eliminação
				transaction.set(binRef, {
					...canticoData,
					deletedAt: serverTimestamp()
				});
	
				// 2. Elimina da coleção original na mesma operação atómica
				transaction.delete(docRef);
			});
	
			return {sucesso: true};
		} catch (error) {
			console.error("Erro ao mover cântico para a reciclagem:", error);
			return {sucesso: false, mensagem: error.message};
		}
	},

	atualizarCantico: async function (id, canticoData) {
		const docRef = doc(db, "canticos", id);
		await updateDoc(docRef, canticoData);
		return true;
	},

	// ===== Funções para folhas =====

	criarFolha: async function (tipo, folhaData, codigoAuth = null) {
		if (!TIPOS_FOLHAS[tipo]) { // "publica" ou "partilhada"
			throw new Error(`Tipo de folha inválido: ${tipo}`);
		}

		if (!codigoAuth) {
			throw new Error(`Código de edição inválido`);
		}

		const timestamp = new Date().toISOString();
		const dadosFolha = {
            id: folhaData.id,
			titulo: folhaData.titulo,
			data: folhaData.data,
			notas: folhaData.notas,
			momentos: folhaData.momentos,
			tipo: tipo,
			dataCriacao: timestamp,
			dataModificacao: timestamp
		};

		// Faz o hash do código
		const salt = AuthUtils.gerarSalt();
		dadosFolha.codigoHash = await AuthUtils.hashCodigo(codigoAuth, salt);
		dadosFolha.codigoSalt = salt;

		// Preserva id
		const docRef = doc(db, TIPOS_FOLHAS[tipo], dadosFolha.id);
		await setDoc(docRef, dadosFolha);
		return docRef.id;
	},

	carregarFolha: async function (tipo, id) {
		if (!TIPOS_FOLHAS[tipo]) {
			return null;
		}

		const docRef = doc(db, TIPOS_FOLHAS[tipo], id);
		const docSnap = await getDoc(docRef);
		if (docSnap.exists()) {
			return docSnap.data();
		}
		else if (tipo === "partilhada") {
			// Se não existir na partilhada, apaga a referência local (se houver)
			localStorage.removeItem(`folha-${id}`);
		}
		return null;
	},

	listarFolhas: async function (tipo) {
		if (!TIPOS_FOLHAS[tipo]) {
			return null;
		}

		const querySnapshot = await getDocs(collection(db, TIPOS_FOLHAS[tipo]));
		const folhas = [];
		querySnapshot.forEach((docSnap) => {
			folhas.push({ id: docSnap.id, ...docSnap.data() });
		});
		return folhas;
	},

	listarFolhaPartilhada: async function (listaId) {
		if (!Array.isArray(listaId) || listaId.length === 0) {
			return [];
		}

		const folhas = [];
		for (const id of listaId) {
			const folha = await this.carregarFolha("partilhada", id);
			if (folha) {
				folhas.push({ ...folha });
			}
		}
		return folhas;
	},


	atualizarFolha: async function(folhaData) {
		if (!TIPOS_FOLHAS[folhaData.tipo] || !folhaData.id) {
			return null;
		}

		const tipo = folhaData.tipo;
		const id = folhaData.id;

		try {
			// Valida o código
			const authResult = await this.authFolha(tipo, id);
			if (!authResult || !authResult.sucesso) {
                return false;
            }

			// Atualiza a folha
			folhaData.dataModificacao = new Date().toISOString();
			const docRef = doc(db, TIPOS_FOLHAS[tipo], id);
			await updateDoc(docRef, folhaData);
			return true;
		} catch (error) {
			console.error("Erro ao atualizar folha:", error);
			return false;
		}
	},

	apagarFolha: async function(tipo, id) {
		if (!TIPOS_FOLHAS[tipo] || !id) {
			return null;
		}

		try {
			// Valida o código
			const authResult = await this.authFolha(tipo, id);
            if (!authResult || !authResult.sucesso) {
                return false;
            }

			// Apaga a folha
			const docRef = doc(db, TIPOS_FOLHAS[tipo], id);
			await deleteDoc(docRef);
			return true;
		} catch (error) {
			console.error("Erro ao apagar folha:", error);
			return false;
		}
	},

	editarCodigoFolha: async function (tipo, id, novoCodigo) {
		if (!TIPOS_FOLHAS[tipo]) {
			return { sucesso: false, erro: "Tipo de folha inválido" };
		}

		// Valida se o novo código não está vazio
		if (!novoCodigo || novoCodigo.trim().length < 4) {
			return { sucesso: false, erro: "O novo código deve ter pelo menos 4 caracteres" };
		}

		try {
			// Valida o código atual se a folha tem autenticação
			const authResult = await this.authFolha(tipo, id);
            if (!authResult || !authResult.sucesso) {
                return { sucesso: false, erro: authResult?.erro || "Código atual incorreto" };
            }

			// Gera novo hash com novo salt
			const novoSalt = AuthUtils.gerarSalt();
			const novoHash = await AuthUtils.hashCodigo(novoCodigo.trim(), novoSalt);

			// Atualiza a folha
			const docRef = doc(db, TIPOS_FOLHAS[tipo], id);
			await updateDoc(docRef, {
				codigoHash: novoHash,
				codigoSalt: novoSalt,
				dataModificacao: new Date().toISOString()
			});

			// Atualiza o cache da sessão
			sessionStorage.setItem(`folha-${id}`, novoCodigo.trim());

			return { sucesso: true, mensagem: "Código alterado com sucesso" };
		} catch (error) {
			console.error("Erro ao editar código:", error);
			return { sucesso: false, erro: "Erro ao alterar o código. Tenta novamente." };
		}
	},

	// ===== Função para mover folhas entre tipos =====

	moverFolha: async function (tipoOrigem, tipoDestino, id) {
		// Validar tipos
		const tiposValidos = ["privada", "partilhada", "publica"];
		if (!tiposValidos.includes(tipoOrigem) || !tiposValidos.includes(tipoDestino)) {
			throw new Error("Tipo de folha inválido");
		}

		// Não fazer nada se origem e destino são iguais
		if (tipoOrigem === tipoDestino) {
			return { id, codigo: null };
		}

		try {
			let folha;
			let codigo = null;

			// Verifica Permissões
			if (tipoOrigem === "partilhada") {
				const authResult = await this.authFolha(tipoOrigem, id);
				if (!authResult.sucesso) throw new Error("Autenticação falhou");

				// Se não foi bypass de admin, usamos o código existente
				if (!authResult.admin_bypass) {
                    codigo = authResult.codigo;

				} else {
                    // Se for admin, o código original é desconhecido. 
                    // Opcional: Podes pedir ao admin para definir um novo código se for mover para pública/partilhada
                    if (tipoDestino !== "privada") {
                        codigo = prompt("Sendo Admin, defina um novo código para esta folha no novo destino (mín. 4 carateres):");
                    }
                }
			}
			if (tipoOrigem === "publica" || tipoDestino === "publica") {
				const authResult = await this.authAdmin();
				if (!authResult.sucesso) alert("Autenticação falhou");

				codigo = this.getCodigoFolha(id);
			}

			// Carregar folha da origem
			if (tipoOrigem === "privada") {
				folha = window.Cancioneiro.folhas.obter(id);
				if (!folha) alert(`Folha privada ${id} não encontrada`);

				// Pede ao utilizador para definir um código de edição para a folha
				while (!codigo || codigo.trim().length < 4) {
					codigo = prompt("Defina um código de edição para a folha (mínimo 4 caracteres):");
					if (codigo === null) alert("Código não fornecido");
				}
			} else { // tipoOrigem === PARTILHADA ou PÚBLICA
				folha = await this.carregarFolha(tipoOrigem, id);
				if (!folha) alert(`Folha ${id} não encontrada`);
			}

			// Preparar dados para guardar no destino
			const dadosNovo = folha;
			dadosNovo.tipo = tipoDestino;
			dadosNovo.dataModificacao = new Date().toISOString();

			// Guardar no destino
			if (tipoDestino === "privada") {
				// Guardar em localStorage
				dadosNovo.id = id;
				delete dadosNovo.codigoHash;
				delete dadosNovo.codigoSalt;
				delete dadosNovo.codigoEdicao;
				window.Cancioneiro.folhas.guardar(dadosNovo);
			} else {
				// Cria Folha no Firebase (partilhada ou pública)
				this.criarFolha(tipoDestino, folha, codigo);
			}

			// Apagar da origem
			if (tipoOrigem === "privada") {
				window.Cancioneiro.folhas.apagar(id);
			} else {
				const docRef = doc(db, TIPOS_FOLHAS[tipoOrigem], id);
				await deleteDoc(docRef);
			}

			return { sucesso : true, codigo : codigo }; // Retorna ID e código gerado
		} catch (error) {
			console.error(`Erro ao mover folha de ${tipoOrigem} para ${tipoDestino}:`, error);
			throw error;
		}
	},

	// ===== Autenticação Admin =====

	/**
	 * Autentica como administrador com código
	 * Email é sempre: admin@cancioneirogjb.com
	 * Token armazenado em sessionStorage (expira ao fechar a tab)
	 */
	authAdmin: async function () {
		// Verifica se já está autenticado nesta sessão
		const adminToken = sessionStorage.getItem("adminToken");
		if (adminToken && this.isAdminValid(adminToken)) {
			return { sucesso: true, ja_autenticado: true };
		}

		// Pede apenas o código
		const codigo = prompt("Código de administrador:");
		if (!codigo) return { sucesso: false, erro: "Código não fornecido" };

		try {
			const email = "admin@cancioneirogjb.com";

			// Tenta autenticar com Firebase Auth
			const userCredential = await signInWithEmailAndPassword(
				auth,
				email,
				codigo.trim()
			);

			// Se chegou aqui, a autenticação funcionou
			const user = userCredential.user;

			// Gera um token único com timestamp
			const adminToken = {
				uid: user.uid,
				email: user.email,
				timestamp: new Date().getTime(),
				token: Math.random().toString(36).substr(2)
			};

			// Armazena em sessionStorage (expira ao fechar a tab)
			sessionStorage.setItem("adminToken", JSON.stringify(adminToken));
			sessionStorage.setItem("adminEmail", user.email);

			return {
				sucesso: true,
				mensagem: "Bem-vindo, administrador!",
				usuario: user.email
			};
		} catch (error) {
			console.error("Erro na autenticação admin:", error);

			let mensagemErro = "Erro na autenticação";
			if (error.code === "auth/user-not-found") {
				mensagemErro = "Admin não encontrado";
			} else if (error.code === "auth/wrong-password") {
				mensagemErro = "Código incorreto";
			}

			return { sucesso: false, erro: mensagemErro };
		}
	},

	/**
	 * Verifica se o utilizador está autenticado como admin
	 */
	isAdminAuthenticated: function () {
		const adminToken = sessionStorage.getItem("adminToken");
		if (!adminToken) return false;

		try {
			const token = JSON.parse(adminToken);
			return this.isAdminValid(token);
		} catch {
			sessionStorage.removeItem("adminToken");
			return false;
		}
	},

	/**
	 * Valida o token admin (duração: 8 horas)
	 */
	isAdminValid: function (adminToken) {
		if (!adminToken) return false;

		try {
			const token = typeof adminToken === "string" ? JSON.parse(adminToken) : adminToken;
			const agora = new Date().getTime();
			const duracao = 8 * 60 * 60 * 1000; // 8 horas em ms

			// Verifica se o token expirou
			return (agora - token.timestamp) < duracao;
		} catch {
			return false;
		}
	},

	/**
	 * Desautentica o admin (faz logout)
	 */
	logoutAdmin: async function () {
		try {
			await signOut(auth);
			sessionStorage.removeItem("adminToken");
			//sessionStorage.removeItem("adminEmail");
			return { sucesso: true, mensagem: "Logout realizado com sucesso" };
		} catch (error) {
			console.error("Erro ao fazer logout:", error);
			return { sucesso: false, erro: "Erro ao fazer logout" };
		}
	},

	/**
	 * Retorna o email do admin autenticado (ou null)
	 */
	getAdminEmail: function () {
		return sessionStorage.getItem("adminEmail");
	},

	// ===== Autenticação Folha Partilhada =====

	/**
	 * Autentica para uma folha partilhada específica
	 * Armazena o código em sessionStorage (expira ao fechar a tab)
	 */
	authFolha: async function (tipo, id) {
		if (!TIPOS_FOLHAS[tipo]) {
            return { sucesso: false, erro: "Tipo de folha inválido" };
        }

		// 0. Tenta obter do cache de sessionStorage
		const authCache = await this.isFolhaAuthenticated(tipo, id);
		if (authCache.sucesso) {
            return { sucesso: true, codigo: authCache.codigo };
        }
		
		// 1. Verifica se está autenticado como Admin
		if (this.isAdminAuthenticated()) {
			return { sucesso: true, admin_bypass: true};
		}

		// 2. Se não tem em cache, pede ao utilizador
		const codigo = prompt("Insira o código de autenticação para esta folha:");
		if (!codigo || !codigo.trim()) {
            return { sucesso: false, erro: "Código não fornecido" };
        }

		const codigoTrim = codigo.trim();

		try {
			// 3. Valida o código
			if (await this._validarCodigo(tipo, id, codigoTrim)) {
				// Armazena em sessionStorage (expira ao fechar a tab)
				sessionStorage.setItem(`folha-${id}`, codigoTrim);
				return { sucesso: true, codigo: codigoTrim };
			}
			return { sucesso: false, erro: "Código incorreto" };
		} catch (error) {
			console.error("Erro na autenticação da folha:", error);
			return { sucesso: false, erro: "Erro ao autenticar. Tenta novamente." };
		}
	},

	/**
	 * Valida o código de uma folha partilhada
	 * @param {any} tipo
	 * @param {any} id
	 * @param {any} codigo
	 * @returns
	 */
	_validarCodigo: async function (tipo, id, codigo) {
		// Carrega a folha
		const folhaAtual = await this.carregarFolha(tipo, id);
		if (!folhaAtual) {
			return false;
		}

		// Valida o código
		const isValido = await AuthUtils.validarCodigo(
			codigo,
			folhaAtual.codigoHash,
			folhaAtual.codigoSalt
		);

		return isValido; // true ou false
	},

	/**
	 * Verifica se a folha está autenticada em cache
	 */
	isFolhaAuthenticated: async function (tipo, id) {
		const codigoCache = this.getCodigoFolha(id);
		if (codigoCache) {
			// Valida o código armazenado em cache
			if (await this._validarCodigo(tipo, id, codigoCache)) {
				return { sucesso: true, codigo: codigoCache };
			}

			// Se não é válido, remove do cache
			sessionStorage.removeItem(`folha-${id}`);
		}
		return { sucesso: false, erro: "Folha não autenticada" };
	},

	/**
	 * Retorna o código de edição da folha (ou null)
	 */
	getCodigoFolha: function (id) {
		return sessionStorage.getItem(`folha-${id}`) || null;
	}
};