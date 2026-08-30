const { exec } = require('child_process')
const path = require('path')
const http = require('http')
const crypto = require('crypto')

const CARPETA_PROYECTO = path.join(__dirname, '..')

function ejecutar(comando) {
  return new Promise((resolve, reject) => {
    exec(comando, { cwd: CARPETA_PROYECTO, maxBuffer: 1024 * 1024 * 20 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message))
      resolve((stdout || '').trim())
    })
  })
}

let actualizando = false

async function actualizarSiHayCambios() {
  if (actualizando) {
    console.log('ꕥ AutoUpdate: ya hay una actualización en curso, se ignora este disparo.')
    return
  }
  actualizando = true

  try {
    await ejecutar('git fetch')

    const local = await ejecutar('git rev-parse HEAD')
    const remoto = await ejecutar('git rev-parse @{u}')

    if (local === remoto) {
      console.log('ꕥ AutoUpdate: sin cambios nuevos.')
      return
    }

    console.log('ꕥ AutoUpdate: se encontraron cambios nuevos, actualizando...')

    const archivosCambiados = await ejecutar(`git diff --name-only ${local} ${remoto}`)
    const cambioPackageJson = archivosCambiados.split('\n').includes('package.json')

    const salidaPull = await ejecutar('git pull')
    console.log(`ꕥ AutoUpdate:\n${salidaPull}`)

    if (cambioPackageJson) {
      console.log('ꕥ AutoUpdate: package.json cambió, instalando dependencias nuevas...')
      await ejecutar('npm install')
    }

    console.log('ꕥ AutoUpdate: reiniciando el bot para aplicar los cambios...')
    process.exit(0)
  } catch (e) {
    console.log('ꕥ AutoUpdate: error revisando actualizaciones ->', e.message)
  } finally {
    actualizando = false
  }
}

function iniciarAutoUpdate(segundos = 10) {
  console.log(`ꕥ AutoUpdate: revisando en vivo cada ${segundos} segundos.`)
  setInterval(actualizarSiHayCambios, segundos * 1000)
}

function firmaValida(secreto, cuerpoRaw, firmaHeader) {
  if (!secreto) return true
  if (!firmaHeader) return false

  const esperada = 'sha256=' + crypto.createHmac('sha256', secreto).update(cuerpoRaw).digest('hex')

  try {
    return crypto.timingSafeEqual(Buffer.from(firmaHeader), Buffer.from(esperada))
  } catch {
    return false
  }
}

function iniciarWebhook({ puerto = 3001, secreto = '', rama = '' } = {}) {
  const servidor = http.createServer((req, res) => {
    if (req.method !== 'POST' || req.url.split('?')[0] !== '/webhook') {
      res.writeHead(404)
      return res.end()
    }

    const partes = []
    req.on('data', (chunk) => partes.push(chunk))
    req.on('end', () => {
      const crudo = Buffer.concat(partes)
      const firmaHeader = req.headers['x-hub-signature-256']

      if (!firmaValida(secreto, crudo, firmaHeader)) {
        console.log('ꕥ AutoUpdate (webhook): firma inválida, petición ignorada.')
        res.writeHead(401)
        return res.end('firma inválida')
      }

      let datos = {}
      try {
        datos = JSON.parse(crudo.toString('utf8') || '{}')
      } catch {}

      const evento = req.headers['x-github-event']

      if (evento === 'ping') {
        console.log('ꕥ AutoUpdate (webhook): ping de GitHub recibido, configuración OK ✅')
        res.writeHead(200)
        return res.end('pong')
      }

      if (evento !== 'push') {
        res.writeHead(200)
        return res.end('evento ignorado')
      }

      if (rama && datos.ref && datos.ref !== `refs/heads/${rama}`) {
        console.log(`ꕥ AutoUpdate (webhook): push a otra rama (${datos.ref}), se ignora.`)
        res.writeHead(200)
        return res.end('rama distinta, ignorado')
      }

      console.log('ꕥ AutoUpdate (webhook): push detectado, actualizando de inmediato...')
      res.writeHead(200)
      res.end('ok, actualizando')
      actualizarSiHayCambios()
    })
  })

  servidor.on('error', (e) => {
    console.log('ꕥ AutoUpdate (webhook): error levantando el servidor ->', e.message)
  })

  servidor.listen(puerto, () => {
    console.log(`ꕥ AutoUpdate: webhook escuchando en el puerto ${puerto} (POST /webhook)`)
  })

  return servidor
}

module.exports = {
  iniciarAutoUpdate,
  iniciarWebhook,
  actualizarSiHayCambios,
  revisarActualizaciones: actualizarSiHayCambios,
}