require('./settings')

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
const { numeroBot, autoUpdatePuerto, autoUpdateSecreto, autoUpdateRama } = require('./settings')
const { iniciarAutoUpdate, iniciarWebhook } = require('./lib/autoupdate')
const { mostrarBannerInicio, mostrarConexionExitosa } = require('./lib/banner')
const { manejarParticipantes } = require('./lib/welcome')

function preguntar(texto) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => rl.question(texto, (respuesta) => {
    rl.close()
    resolve(respuesta.trim())
  }))
}

async function iniciar() {
  console.log('ꕥ Cargando sesión...')

  const { state, saveCreds } = await useMultiFileAuthState(path.join(__dirname, 'session'))

  console.log('ꕥ Sesión cargada, abriendo conexión...')

  const usarCodigoVinculacion = !state.creds.registered

  const { version } = await fetchLatestBaileysVersion()
  console.log(`ꕥ Usando versión de WhatsApp Web: ${version.join('.')}`)

  const conn = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
    },
    printQRInTerminal: false,
    logger: pino({ level: 'silent' }),
    browser: ['Mac OS', 'Chrome', '10.15.7'],
    markOnlineOnConnect: true,
    generateHighQualityLinkPreview: true,
    syncFullHistory: false,
    getMessage: async () => ({ conversation: global.botName || 'Tech Master Bot' }),
  })

  console.log('ꕥ Socket creado.')

  let codigoYaSolicitado = false

  if (usarCodigoVinculacion) {
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

  conn.ev.on('creds.update', saveCreds)

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

  conn.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return

    const msg = messages[0]
    if (!msg.message || msg.key.fromMe) return

    const m = serializarMensaje(msg)

    try {
      await handler(conn, m)
    } catch (e) {
      console.log('Error en handler:', e)
    }
  })

  conn.ev.on('group-participants.update', async (evento) => {
    try {
      await manejarParticipantes(conn, evento)
    } catch (e) {
      console.log('Error en group-participants.update:', e)
    }
  })

  return conn
}

function serializarMensaje(msg) {
  const tipoMensaje = Object.keys(msg.message)[0]
  const contenido = msg.message[tipoMensaje]

  const texto =
    contenido?.text ||
    contenido?.caption ||
    (tipoMensaje === 'conversation' ? msg.message.conversation : '') ||
    ''

  const sender = msg.key.participant || msg.key.remoteJid

  const senderAlt = msg.key.participantAlt || msg.key.participantPn || null
  const senderNumero = (sender.endsWith('@lid') && senderAlt) ? senderAlt : sender

  return {
    raw: msg,
    key: msg.key,
    chat: msg.key.remoteJid,
    sender,
    senderNumero,
    fromMe: msg.key.fromMe,
    text: texto,
    isGroup: msg.key.remoteJid?.endsWith('@g.us'),
  }
}

mostrarBannerInicio(global.botName, '1.0.0')
iniciar()

iniciarWebhook({ puerto: autoUpdatePuerto, secreto: autoUpdateSecreto, rama: autoUpdateRama })
iniciarAutoUpdate(30)