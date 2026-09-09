global.botName = 'Tech Master Bot'

// Acepta cualquiera de estos símbolos como prefijo, o directamente
// ningún prefijo (el comando se reconoce igual escrito a secas).
global.prefix = /^[#!.\/$%*+=?~^-]/

global.owner = [
  ['584223342535', 'Matthieu'],
  ['51910227479', 'AmilcarGit'],
  ['542645746772', 'Damian'],
  ['5493875132593', 'Benja'],
  ['573225396540', 'sprohub'],
]

global.creators = [
  { nombre: 'Matthieu', rol: 'Creador' },
  { nombre: 'AmilcarGit', rol: 'Creador' },
  { nombre: 'Damian', rol: 'Creador' },
  { nombre: 'Benja', rol: 'Creador' },
  { nombre: 'sprohub', rol: 'colaborador' },
]

global.stickerPack = {
  nombre: global.botName,
  autor: 'Tech Master Bot',
}

global.evogbApiKey = 'evogb-SNjiEiMu'

global.autoUpdatePuerto = 3001

global.autoUpdateSecreto = 'cambia-esto-por-un-secreto-largo'

global.autoUpdateRama = 'main'

// Datos de tu cuenta en https://api-orbit-9doj.onrender.com
// Rellena estos 2 datos con el correo y contraseña de TU cuenta de Orbit
// (la misma con la que entras al dashboard). Esto es lo unico que hay
// que cambiar para que el bot se registre solo y no vuelva a dar error 403.
global.orbitUrl = 'https://api-orbit-9doj.onrender.com'
global.orbitEmail = 'matthieu-x@admin.orbit'
global.orbitPassword = 'Orbit2026'

module.exports = {
  botName: global.botName,
  prefix: global.prefix,
  owner: global.owner,
  creators: global.creators,
  stickerPack: global.stickerPack,
  evogbApiKey: global.evogbApiKey,
  autoUpdatePuerto: global.autoUpdatePuerto,
  autoUpdateSecreto: global.autoUpdateSecreto,
  autoUpdateRama: global.autoUpdateRama,
  orbitUrl: global.orbitUrl,
  orbitEmail: global.orbitEmail,
  orbitPassword: global.orbitPassword,
}