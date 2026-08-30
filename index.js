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
  makeCacheableSignalKeyStore,
  delay,
} = require('@whiskeysockets/baileys')

const pino = require('pino')
const path = require('path')
const readline = require('readline')
const handler = require('./handler')
const { numeroBot } = require('./settings')
const { iniciarAutoUpdate } = require('./lib/autoupdate')
const { mostrarBannerInicio, mostrarConexionExitosa } = require('./lib/banner')
const { manejarParticipantes } = require('./lib/welcome')

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

  // Pedimos la versión más reciente del protocolo de WhatsApp Web.
  // Con @itsliaaa/baileys (a diferencia de ultra-baileys) SÍ hace falta
  // pedirla explícitamente, o WhatsApp rechaza la vinculación por versión
  // desactualizada ("No se pudo vincular el dispositivo").
  const { version } = await fetchLatestBaileysVersion()
  console.log(`ꕥ Usando versión de WhatsApp Web: ${version.join('.')}`)

  const conn = makeWASocket({
    version,
    // OJO: envolver las 'keys' con makeCacheableSignalKeyStore es importante.
    // Sin esto, el paso criptográfico (Signal Protocol) del pairing code
    // puede fallar de forma silenciosa con @itsliaaa/baileys: el servidor
    // "acepta" el proceso pero el celular nunca confirma ("No se pudo
    // vincular el dispositivo"). Con auth: state a secas, ese envoltorio
    // no existe.
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
    },
    printQRInTerminal: false, // desactivado: usamos código de vinculación, no QR
    logger: pino({ level: 'silent' }), // silencia los logs internos de baileys
    browser: ['Mac OS', 'Chrome', '10.15.7'],
    markOnlineOnConnect: true,
    generateHighQualityLinkPreview: true,
    syncFullHistory: false,
    getMessage: async () => ({ conversation: global.botName || 'Tech Master Bot' }),
  })

  console.log('ꕥ Socket creado.')

  let codigoYaSolicitado = false

  // IMPORTANTE: a diferencia de un intento anterior, aquí NO esperamos al
  // evento 'connecting' para pedir el código -- lo pedimos con un
  // temporizador fijo desde el momento en que se crea el socket, igual que
  // hace FamilyBot-MD (que sí conecta con este mismo fork). Esperar al
  // evento 'connecting' resultó no ser confiable con @itsliaaa/baileys.
  if (usarCodigoVinculacion) {
    // Orden de prioridad para el número:
    // 1) argumento al arrancar -> node index.js 521XXXXXXXXXX
    // 2) global.numeroBot en settings.js (si lo llenaste)
    // 3) preguntarlo por consola (puede no funcionar en paneles sin stdin real)
    const numeroArgumento = process.argv[2]
    const numeroCrudo = (numeroArgumento && numeroArgumento.trim())
      ? numeroArgumento.trim()
      : (numeroBot && numeroBot.trim())
        ? numeroBot.trim()
        : await preguntar('Ingresa el número de WhatsApp del bot (con código de país, sin +): ')

    const numeroParaCodigo = numeroCrudo.replace(/[^0-9]/g, '')

    setTimeout(async () => {
      if (codigoYaSolicitado || conn.authState?.creds?.registered) return
      codigoYaSolicitado = true
      console.log(`ꕥ Solicitando código de vinculación para ${numeroParaCodigo}...`)
      try {
        await delay(3000)
        const codigo = await conn.requestPairingCode(numeroParaCodigo)
        console.log(`ꕥ Código de vinculación: ${codigo}`)
        console.log('> Ve a WhatsApp > Dispositivos vinculados > Vincular con número de teléfono, e ingresa este código.')
      } catch (e) {
        console.log('Error solicitando el código de vinculación:', e)
        codigoYaSolicitado = false
      }
    }, 8000)
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
      mostrarConexionExitosa(global.botName)
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

  // Escucha entradas/salidas de grupo (para welcome/despedida).
  // La lógica de qué mandar y si está activado vive en lib/welcome.js,
  // así este archivo no se llena de texto de mensajes.
  conn.ev.on('group-participants.update', async (evento) => {
    try {
      await manejarParticipantes(conn, evento)
    } catch (e) {
      console.log('Error en group-participants.update:', e)
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

  const sender = msg.key.participant || msg.key.remoteJid // jid real de quien escribió (sirve para mención real)

  // OJO: desde que WhatsApp usa @lid en varios grupos, "sender" puede ser
  // un identificador interno (ej: 269715926691844@lid) en vez del número
  // de teléfono real. WhatsApp igual manda el número real en un campo
  // alterno (participantAlt / participantPn) -- lo usamos para todo lo
  // que necesite comparar contra un número de teléfono real (ej: owner).
  const senderAlt = msg.key.participantAlt || msg.key.participantPn || null
  const senderNumero = (sender.endsWith('@lid') && senderAlt) ? senderAlt : sender

  return {
    raw: msg,
    key: msg.key,
    chat: msg.key.remoteJid, // grupo o chat privado
    sender, // jid "de mención" -- puede ser @lid, úsalo para @mencionar
    senderNumero, // jid con el número de teléfono real -- úsalo para comparar owners, etc.
    fromMe: msg.key.fromMe,
    text: texto,
    isGroup: msg.key.remoteJid?.endsWith('@g.us'),
  }
}

mostrarBannerInicio(global.botName, '1.0.0')
iniciar()
iniciarAutoUpdate(5) // revisa el repo cada 5 minutos y se auto-actualiza si hay cambios
