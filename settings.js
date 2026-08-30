/**
 * settings.js
 * -------------------------------------------------------
 * Configuración central del bot. Todo lo que cambie poco
 * (nombre, prefijo, owners, créditos) va aquí para no andar
 * buscando entre el código.
 * -------------------------------------------------------
 */

// Nombre del bot, se usa en el menú y mensajes generales
global.botName = 'Tech Master Bot'

// Prefijo(s) aceptados antes de un comando. Ej: #ping, !ping, .ping
global.prefix = /^[#!./]/

// Owners del bot -> pueden usar comandos exclusivos (ej: savefile).
// Formato: [ 'numero_sin_+_ni_espacios', 'Nombre' ]
// Agrega aquí el número real del bot cuando lo tengas.
global.owner = [
  ['0000000000', 'Matthieu'], // <-- reemplaza 0000000000 por tu número real
]

// Créditos / creadores del proyecto (para el menú, about, etc.)
// Deja el objeto vacío tal cual para la vacante que vas a llenar después.
global.creators = [
  { nombre: 'Matthieu', rol: 'Creador' },
  { nombre: 'AmilcarGit', rol: 'Creador' },
  { nombre: 'Damian', rol: 'Creador' },
  { nombre: '', rol: '' }, // <-- vacante, se agrega después
]

module.exports = {
  botName: global.botName,
  prefix: global.prefix,
  owner: global.owner,
  creators: global.creators,
}
