/**
 * plugins/pbotonesdemo.js
 * -------------------------------------------------------
 * Plugin de prueba para el helper lib/botones.js.
 * .botonesdemo -> manda 3 botones
 * .listademo   -> manda una lista con 2 secciones
 * -------------------------------------------------------
 */

const { enviarBotones, enviarLista } = require('../lib/botones')

let handler = async (m, { conn, usedPrefix }) => {
  const prefijo = usedPrefix || '#'

  const [comando] = m.text.slice(prefijo.length).trim().split(/\s+/)

  if (comando.toLowerCase() === 'listademo') {
    return enviarLista(conn, m.chat, {
      texto: 'ꕥ *Elige una opción de la lista*',
      footer: 'Tech Master Bot',
      titulo: 'Menú de prueba',
      textoBoton: 'Ver opciones',
      mensajeCitado: m.raw,
      secciones: [
        {
          titulo: 'Sección 1',
          filas: [
            { titulo: 'Ping', id: `${prefijo}ping`, descripcion: 'Prueba de conexión' },
            { titulo: 'Menú', id: `${prefijo}menu`, descripcion: 'Ver todos los comandos' },
          ],
        },
        {
          titulo: 'Sección 2',
          filas: [
            { titulo: 'Perfil', id: `${prefijo}perfil`, descripcion: 'Ver tu perfil' },
          ],
        },
      ],
    })
  }

  return enviarBotones(conn, m.chat, {
    texto: 'ꕥ *Elige una opción*',
    footer: 'Tech Master Bot',
    mensajeCitado: m.raw,
    botones: [
      { texto: '🏓 Ping', id: `${prefijo}ping` },
      { texto: '📜 Menú', id: `${prefijo}menu` },
      { texto: '👤 Perfil', id: `${prefijo}perfil` },
    ],
  })
}

handler.help = ['botonesdemo', 'listademo']
handler.tags = ['general']
handler.command = ['botonesdemo', 'listademo']

module.exports = handler