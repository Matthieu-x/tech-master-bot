# Tech Master Bot

Base de bot de WhatsApp usando `ultra-baileys`.

## Creadores
- Matthieu
- AmilcarGit
- Damian
- (vacante)

## Instalación
```
npm install
node index.js
```

La primera vez te pide el número de WhatsApp del bot (con código de país,
sin +) y te muestra un **código de vinculación personalizado (TECHBOTS)**
en consola. Vas a WhatsApp > Dispositivos vinculados > Vincular con número
de teléfono, y metes ese código. No usa QR.

## Estructura
```
tech-master-bot/
├── index.js        # conexión con WhatsApp (código de vinculación)
├── handler.js       # carga plugins y ejecuta comandos
├── settings.js       # nombre, prefijo, owners, creadores
├── lib/dfail.js       # mensajes de error con estilo
└── plugins/
    ├── pping.js        # ejemplo: comando simple
    ├── pmenu.js        # ejemplo: menú + mención real por jid
    └── psavefile.js     # (owner) crea plugins nuevos desde WhatsApp
```

## Crear un plugin nuevo
Copia `plugins/pping.js`, cámbiale el nombre de archivo y el
`handler.command`. El bot lo carga automáticamente, sin reiniciar.
