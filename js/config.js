/* Configuración general. Todo lo "tocable" está acá. */
(function (root) {
  root.CF = root.CF || {};
  root.CF.Config = {
    appName: 'Casino Familiar',
    version: '1.0.0',

    // Fichas con las que arranca cada jugador (no hay recarga automática).
    startingChips: 1000,

    // PIN para entrar al panel Admin (reponer fichas, agregar jugadores).
    // OJO: es un candado para chicos curiosos, no seguridad real (el código es público).
    adminPin: '1234',

    // Valores de apuesta que aparecen en los botones.
    bets: [10, 50, 100, 500],

    // Prefijo de lo que se guarda en el navegador (localStorage).
    storagePrefix: 'cf.v1.',

    // Jugadores iniciales (se crean la primera vez que se abre el juego en un dispositivo).
    defaultProfiles: [
      { id: 'gaston', name: 'Gastón', emoji: '🧔', color: '#3df5ff' },
      { id: 'eli', name: 'Eli', emoji: '👩', color: '#ff3d9a' },
      { id: 'dante', name: 'Dante', emoji: '👦', color: '#3dffa0' },
      { id: 'mia', name: 'Mía', emoji: '👧', color: '#ffc94a' }
    ]
  };
})(typeof self !== 'undefined' ? self : this);
