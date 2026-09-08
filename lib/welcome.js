/**
 * lib/welcome.js
 * -------------------------------------------------------
 * Maneja el evento group-participants.update de Baileys:
 * manda bienvenida (con tarjeta) cuando alguien entra y
 * despedida en texto cuando alguien sale -- si están
 * activados para ese grupo.
 *
 * El on/off por grupo se controla con el comando de chat
 * en plugins/pwelcome.js (#welcome on/off, #bye on/off).
 * -------------------------------------------------------
 */

const { obtenerGrupo } = require('./db')
const { generarTarjetaBienvenida } = require('./tarjetas')

/**
 * Normaliza un elemento de "participants": puede venir como string
 * plano ("5199...@lid") o como objeto ({ id: '...' }, { jid: '...' })
 * dependiendo de la versión/fork de Baileys y del sistema @lid.
 */
function extraerJid(participante) {
  if (typeof participante === 'string') return participante
  return participante?.id || participante?.jid || participante?.participant || ''
}

async function manejarParticipantes(conn, evento) {
  const { id: chat, participants, action } = evento

  if (!chat?.endsWith('@g.us')) return
  if (action !== 'add' && action !== 'remove') return // ignora promote/demote/etc.

  const config = obtenerGrupo(chat)
  if (action === 'add' && !config.welcome) return
  if (action === 'remove' && !config.bye) return

  let nombreGrupo = ''
  let numeroMiembros = 0
  try {
    const metadata = await conn.groupMetadata(chat)
    nombreGrupo = metadata.subject || ''
    numeroMiembros = metadata.participants?.length || 0
  } catch (e) {
    nombreGrupo = ''
  }

  for (const participante of participants) {
    const jid = extraerJid(participante)
    if (!jid) continue

    const numero = jid.split('@')[0]

    if (action === 'add') {
      try {
        const tarjeta = await generarTarjetaBienvenida({
          conn,
          jid,
          nombreUsuario: `@${numero}`,
          nombreGrupo,
          numeroMiembros,
        })

        await conn.sendMessage(chat, {
          image: tarjeta,
          caption: `ꕥ *¡Bienvenido/a!*\n> @${numero} se unió${nombreGrupo ? ` a *${nombreGrupo}*` : ''} 🎉`,
          mentions: [jid],
        })
      } catch (e) {
        console.log(`ꕥ\n> Error generando tarjeta de bienvenida en ${chat}: ${e.message}`)
        await conn.sendMessage(chat, {
          text: `ꕥ *¡Bienvenido/a!*\n> @${numero} se unió${nombreGrupo ? ` a *${nombreGrupo}*` : ''} 🎉`,
          mentions: [jid],
        }).catch(() => {})
      }
      continue
    }

    try {
      await conn.sendMessage(chat, {
        text: `ꕥ *Hasta luego*\n> @${numero} salió del grupo 👋`,
        mentions: [jid],
      })
    } catch (e) {
      console.log(`ꕥ\n> Error mandando bye en ${chat}: ${e.message}`)
    }
  }
}

module.exports = { manejarParticipantes }