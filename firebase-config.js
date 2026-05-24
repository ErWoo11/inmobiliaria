// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCs-bwrZgpH4foUA35b_wLTYqvRlsaE-pQ",
  authDomain: "inmobiliaria-645cf.firebaseapp.com",
  projectId: "inmobiliaria-645cf",
  storageBucket: "inmobiliaria-645cf.firebasestorage.app",
  messagingSenderId: "602378957066",
  appId: "1:602378957066:web:9f06ed4d0cf564953bcaf3"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };