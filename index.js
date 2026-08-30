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
} = require('@whiskeysockets/baileys')

const pino = require('pino')
const path = require('path')
const readline = require('readline')
const handler = require('./handler')
const { numeroBot } = require('./settings')

// Helper para pedir el número por consola (solo se usa si no llenaste
// global.numeroBot en settings.js ni pasaste el número como argumento)
function preguntar(texto) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => rl.question(texto, (respuesta) => {
    rl.close()
    resolve(respuesta.trim())
  }))
}

async function iniciar() {
  console.log('ꕥ Cargando sesión...')

  // Guarda las credenciales de la sesión en la carpeta /session
  const { state, saveCreds } = await useMultiFileAuthState(path.join(__dirname, 'session'))

  console.log('ꕥ Sesión cargada, abriendo conexión...')

  // Solo se pide vincular por código si todavía no hay sesión registrada
  const usarCodigoVinculacion = !state.creds.registered

  // OJO: no llamamos fetchLatestBaileysVersion() aquí. ultra-baileys ya
  // trae una versión de WA "fijada" por defecto (lo dice su propio banner
  // al arrancar). Pedirla nosotros mismos hace una petición HTTP externa
  // que en varios hostings (HidenCloud incluido) se queda colgada sin
  // avisar, y por eso el bot parecía no ejecutar nada.
  const conn = makeWASocket({
    auth: state,
    printQRInTerminal: false, // desactivado: usamos código de vinculación, no QR
    logger: pino({ level: 'silent' }), // silencia los logs internos de baileys
    browser: [global.botName || 'Tech Master Bot', 'Chrome', '1.0.0'],
  })

  console.log('ꕥ Socket creado.')

  if (usarCodigoVinculacion) {
    // Orden de prioridad para el número:
    // 1) argumento al arrancar -> node index.js 521XXXXXXXXXX
    // 2) global.numeroBot en settings.js (si lo llenaste)
    // 3) preguntarlo por consola (puede no funcionar en paneles sin stdin real)
    const numeroArgumento = process.argv[2]
    const numero = (numeroArgumento && numeroArgumento.trim())
      ? numeroArgumento.trim()
      : (numeroBot && numeroBot.trim())
        ? numeroBot.trim()
        : await preguntar('Ingresa el número de WhatsApp del bot (con código de país, sin +): ')

    console.log(`ꕥ Solicitando código de vinculación para ${numero}...`)

    // requestPairingCode(numero) -> WhatsApp genera un código aleatorio
    // (sin personalizar) y lo muestra en el celular real para confirmar.
    const codigo = await conn.requestPairingCode(numero.replace(/[^0-9]/g, ''))
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
