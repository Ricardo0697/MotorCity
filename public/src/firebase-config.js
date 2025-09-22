// Pega aquí tu configuración de Firebase (del panel Firebase)
const firebaseConfig = {
apiKey: "YOUR_API_KEY",
authDomain: "YOUR_PROJECT.firebaseapp.com",
projectId: "YOUR_PROJECT_ID",
// ... el resto
};


// Inicializa Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();


// Export simple (global) para usar en otros scripts
window.firebaseDB = db;