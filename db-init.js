// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-app.js";
import { getFirestore, collection, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-analytics.js";

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

// Expor a base de dados para ser usada pelo app.js, cantico.js, folhas.js, etc.
window.Cancioneiro = window.Cancioneiro || {};
window.Cancioneiro.db = db;

// --- NOVAS FUNÇÕES GLOBAIS DE BASE DE DADOS ---

window.Cancioneiro.dbApi = {
	carregarIndice: async function() {
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

	// --- NOVAS FUNÇÕES PARA FOLHAS PARTILHADAS ---
	criarFolhaPartilhada: async function(folhaData, codigoAuth) {
		const { addDoc, collection } = await import("https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js");
		const docRef = await addDoc(collection(db, "folhas"), {
			...folhaData,
			codigoAuth: codigoAuth, // NOTA: Numa app real devia ser um hash, mas para este caso servirá
			dataCriacao: new Date().toISOString()
		});
		return docRef.id;
	},

	carregarFolhaPartilhada: async function(id) {
		const docRef = doc(db, "folhas", id);
		const docSnap = await getDoc(docRef);
		if (docSnap.exists()) {
			return docSnap.data();
		}
		return null;
	},

	listarFolhasPartilhadas: async function() {
		const { getDocs, collection } = await import("https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js");
		const querySnapshot = await getDocs(collection(db, "folhas"));
		const folhas = [];
		querySnapshot.forEach((docSnap) => {
			folhas.push({ id: docSnap.id, ...docSnap.data() });
		});
		return folhas;
	},

	atualizarFolhaPartilhada: async function(id, folhaData, codigoAuthFornecido) {
		const { updateDoc } = await import("https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js");
		
		// Verifica a senha atual antes de atualizar
		const folhaAtual = await this.carregarFolhaPartilhada(id);
		if (!folhaAtual || folhaAtual.codigoAuth !== codigoAuthFornecido) {
			return false; // Senha incorreta ou folha inexistente
		}

		const docRef = doc(db, "folhas", id);
		await updateDoc(docRef, folhaData);
		return true;
	},

	apagarFolhaPartilhada: async function(id, codigoAuthFornecido) {
		const { deleteDoc } = await import("https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js");
		
		// Verifica a senha atual antes de apagar
		const folhaAtual = await this.carregarFolhaPartilhada(id);
		if (!folhaAtual || folhaAtual.codigoAuth !== codigoAuthFornecido) {
			return false; // Senha incorreta ou folha inexistente
		}

		const docRef = doc(db, "folhas", id);
		await deleteDoc(docRef);
		return true;
	}
};