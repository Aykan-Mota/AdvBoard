  import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
  import { getFirestore, doc, setDoc, getDoc, collection, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
  import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged,
           sendPasswordResetEmail, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

  // =====================================================
  // ⚙️ CONFIGURAÇÃO DO FIREBASE
  // =====================================================
  const firebaseConfig = {
    apiKey: "AIzaSyBieoEDFUMxUpG6Pf9fOFDFeOc5NwF_soc",
    authDomain: "advboard-26.firebaseapp.com",
    projectId: "advboard-26",
    storageBucket: "advboard-26.firebasestorage.app",
    messagingSenderId: "963143003828",
    appId: "1:963143003828:web:d1f3af719c46c2500cf1e1"
  };

  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  const auth = getAuth(app);

  // Exporta funções para o escopo global
  window._firestore = db;
  window._firestoreDoc = doc;
  window._firestoreSetDoc = setDoc;
  window._firestoreGetDoc = getDoc;
  window._firestoreCollection = collection;
  window._firestoreOnSnapshot = onSnapshot;
  window._firebaseReady = true;

  // =====================================================
  // 🔐 FIREBASE AUTHENTICATION
  // =====================================================

  // Função de login via Firebase Auth
  window._firebaseSignIn = async (email, password) => {
    return signInWithEmailAndPassword(auth, email, password);
  };

  // Função de logout via Firebase Auth
  window._firebaseSignOut = async () => {
    return signOut(auth);
  };

  // Função para criar usuário no Firebase Auth
  window._firebaseCreateUser = async (email, password) => {
    return createUserWithEmailAndPassword(auth, email, password);
  };

  // Observador de estado de autenticação
  window._firebaseOnAuthStateChanged = (callback) => {
    return onAuthStateChanged(auth, callback);
  };

  // Envia e-mail de recuperação de senha
  window._firebaseSendPasswordReset = async (email) => {
    return sendPasswordResetEmail(auth, email);
  };

  // Reautentica o usuário com a senha atual (necessário antes de trocar senha)
  window._firebaseReauth = async (email, currentPassword) => {
    const credential = EmailAuthProvider.credential(email, currentPassword);
    return reauthenticateWithCredential(auth.currentUser, credential);
  };

  // Atualiza a senha do usuário autenticado
  window._firebaseUpdatePassword = async (newPassword) => {
    return updatePassword(auth.currentUser, newPassword);
  };

  // Expõe o usuário atual do Firebase Auth
  window._firebaseGetCurrentUser = () => auth.currentUser;

  // Dispara evento avisando que o Firebase está pronto
  window.dispatchEvent(new Event('firebase-ready'));
