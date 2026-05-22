// Ponto de entrada da aplicação
// Aguarda o Firebase estar 100% pronto antes de inicializar o sistema.
// O firebase-init.js é um módulo ES (sempre "deferred") e executa DEPOIS
// dos scripts regulares — por isso usamos o evento 'firebase-ready'.
window.addEventListener('firebase-ready', initSystem, { once: true });
