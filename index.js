/**
 * index.js
 * -------------------------------------------------------
 * Punto de entrada del bot. Se conecta a WhatsApp usando
 * ultra-baileys (github:russellxz/ultra-baileys), mantiene
 * la sesión guardada en /session y reenvía cada mensaje
 * entrante al handler.js para que decida qué hacer.
 * -------------------------------------------------------
 */

require('./settings') // carga global.botName, global.prefix, etc.

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} = require('baileys')

const pino = require('pino')
const path = require('path')
const readline = require('readline')
const handler = require('./handler')

// Código de vinculación personalizado (8 caracteres, va sin guion, la
// librería lo formatea al mostrarlo). Cámbialo aquí si quieres otro.
const CODIGO_PERSONALIZADO = 'TECHBOTS'

// Helper para pedir el número por consola (solo se pide la primera vez,
// mientras no exista una sesión guardada en /session)
function preguntar(texto) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => rl.question(texto, (respuesta) => {
    rl.close()
    resolve(respuesta.trim())
  }))
}

async function iniciar() {
  // Guarda las credenciales de la sesión en la carpeta /session
  const { state, saveCreds } = await useMultiFileAuthState(path.join(__dirname, 'session'))
  const { version } = await fetchLatestBaileysVersion()

  // Solo se pide vincular por código si todavía no hay sesión registrada
  const usarCodigoVinculacion = !state.creds.registered

  const conn = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false, // desactivado: usamos código de vinculación, no QR
    logger: pino({ level: 'silent' }), // silencia los logs internos de baileys
    browser: [global.botName || 'Tech Master Bot', 'Chrome', '1.0.0'],
  })

  if (usarCodigoVinculacion) {
    const numero = await preguntar('Ingresa el número de WhatsApp del bot (con código de país, sin +): ')
    // requestPairingCode(numero, códigoPersonalizado) -> WhatsApp muestra
    // este código en el celular real para confirmar la vinculación.
    const codigo = await conn.requestPairingCode(numero.replace(/[^0-9]/g, ''), CODIGO_PERSONALIZADO)
    console.log(`ꕥ Código de vinculación: ${codigo}`)
    console.log('> Ve a WhatsApp > Dispositivos vinculados > Vincular con número de teléfono, e ingresa este código.')
  }

  // Guarda credenciales cada vez que cambian
  conn.ev.on('creds.update', saveCreds)

  // Maneja reconexión automática si el bot se cae
  conn.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update

    if (connection === 'close') {
      const razon = lastDisconnect?.error?.output?.statusCode
      const debeReconectar = razon !== DisconnectReason.loggedOut
      console.log('Conexión cerrada.', debeReconectar ? 'Reconectando...' : 'Sesión cerrada, escanea el QR de nuevo.')
      if (debeReconectar) iniciar()
    } else if (connection === 'open') {
      console.log(`✅ ${global.botName} conectado correctamente.`)
    }
  })

  // Escucha mensajes entrantes
  conn.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return

    const msg = messages[0]
    if (!msg.message || msg.key.fromMe) return // ignora mensajes propios/vacíos

    // "Serializamos" el mensaje a un formato simple y cómodo para los plugins
    const m = serializarMensaje(msg)

    try {
      await handler(conn, m)
    } catch (e) {
      console.log('Error en handler:', e)
    }
  })

  return conn
}

/**
 * Convierte el mensaje crudo de baileys en un objeto simple
 * con lo que normalmente necesita un plugin: chat, sender, text, etc.
 */
function serializarMensaje(msg) {
  const tipoMensaje = Object.keys(msg.message)[0]
  const contenido = msg.message[tipoMensaje]

  const texto =
    contenido?.text ||
    contenido?.caption ||
    (tipoMensaje === 'conversation' ? msg.message.conversation : '') ||
    ''

  return {
    raw: msg,
    key: msg.key,
    chat: msg.key.remoteJid, // grupo o chat privado
    sender: msg.key.participant || msg.key.remoteJid, // jid real de quien escribió (sirve para mención real)
    fromMe: msg.key.fromMe,
    text: texto,
    isGroup: msg.key.remoteJid?.endsWith('@g.us'),
  }
}

iniciar()
