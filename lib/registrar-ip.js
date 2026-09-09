// Registra automáticamente la IP del VPS en Orbit API cada vez que el bot
// arranca, para que nunca más de el error 403 (HTTP 403 = "IP no reconocida").
// No hace falta saber la IP del VPS: la propia API la detecta sola cuando
// este código le habla desde el VPS.

const { orbitUrl, orbitEmail, orbitPassword } = require('../settings')

async function registrarIpOrbit() {
  if (!orbitEmail || orbitEmail === 'matthieu-x@admin.orbit' || !orbitPassword || orbitPassword === 'Orbit2026') {
    console.log('⚠️  [Orbit] Falta poner tu correo y contraseña de Orbit en settings.js — se omite el registro automático de IP.')
    return
  }

  try {
    const loginRes = await fetch(`${orbitUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: orbitEmail, password: orbitPassword })
    })

    const loginData = await loginRes.json().catch(() => ({}))

    if (!loginRes.ok || !loginData.ok) {
      console.log('⚠️  [Orbit] No se pudo iniciar sesión para registrar la IP:', loginData.error || loginRes.status)
      return
    }

    const setCookie = loginRes.headers.get('set-cookie')
    const cookie = setCookie ? setCookie.split(';')[0] : null

    if (!cookie) {
      console.log('⚠️  [Orbit] No se recibió cookie de sesión, no se pudo registrar la IP.')
      return
    }

    const resetRes = await fetch(`${orbitUrl}/api/user/ip-config/reset`, {
      method: 'POST',
      headers: { Cookie: cookie }
    })

    const resetData = await resetRes.json().catch(() => ({}))

    if (resetRes.ok && resetData.ok) {
      console.log('✅ [Orbit] IP del bot registrada correctamente:', (resetData.ips || []).join(', '))
    } else {
      console.log('⚠️  [Orbit] No se pudo registrar la IP:', resetData.error || resetRes.status)
    }
  } catch (error) {
    console.log('⚠️  [Orbit] Error registrando la IP del bot:', error.message)
  }
}

module.exports = { registrarIpOrbit }
