import { join } from 'node:path'
import app from '@adonisjs/core/services/app'
import makeWASocket, { useMultiFileAuthState, DisconnectReason, downloadMediaMessage } from '@whiskeysockets/baileys'
import pino from 'pino'
import WhatsappChat from '#models/whatsapp_chat'
import Station from '#models/station'
import Route from '#models/route'
import Bus from '#models/bus'
import Arrival from '#models/arrival'
import env from '#start/env'

export class WhatsappService {
  private sock: any = null
  private qrCode: string | null = null
  private status: 'DISCONNECTED' | 'INITIALIZING' | 'QR_READY' | 'CONNECTED' | 'ERROR' = 'DISCONNECTED'
  private errorMessage: string | null = null

  private static getGlobalRef(): any {
    const globalRef = global as any
    if (!globalRef.__whatsappServiceInstance) {
      globalRef.__whatsappServiceInstance = new WhatsappService()
    }
    return globalRef.__whatsappServiceInstance
  }

  public static getInstance(): WhatsappService {
    return this.getGlobalRef()
  }

  public getQrCode() {
    return this.qrCode
  }

  public getStatus() {
    return {
      status: this.status,
      errorMessage: this.errorMessage,
    }
  }

  public async initialize() {
    if (this.sock) return

    this.status = 'INITIALIZING'
    console.log('[SITME WhatsApp] Initializing Baileys client...')

    try {
      const authPath = join(app.tmpPath(), 'baileys_auth')
      const { state, saveCreds } = await useMultiFileAuthState(authPath)

      this.sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }), // Keep server logs clean
        printQRInTerminal: true,
      })

      this.sock.ev.on('creds.update', saveCreds)

      this.sock.ev.on('connection.update', (update: any) => {
        const { connection, lastDisconnect, qr } = update

        if (qr) {
          this.qrCode = qr
          this.status = 'QR_READY'
          console.log('[SITME WhatsApp] New Baileys QR code generated. Scan it to connect!')
        }

        if (connection === 'close') {
          this.qrCode = null
          const statusCode = (lastDisconnect?.error as any)?.output?.statusCode
          const shouldReconnect =
            statusCode !== DisconnectReason.loggedOut &&
            statusCode !== DisconnectReason.connectionReplaced &&
            statusCode !== 440

          console.log(`[SITME WhatsApp] Connection closed. Reason code: ${statusCode}`, lastDisconnect?.error)

          if (shouldReconnect) {
            console.log('[SITME WhatsApp] Reconnecting...')
            this.sock = null
            this.status = 'INITIALIZING'
            this.initialize()
          } else {
            console.log('[SITME WhatsApp] Logged out or session replaced (conflict). Stopping reconnection.')
            this.status = 'DISCONNECTED'
            this.sock = null
          }
        } else if (connection === 'open') {
          this.status = 'CONNECTED'
          this.qrCode = null
          this.errorMessage = null
          console.log('[SITME WhatsApp] WhatsApp Baileys Client is Connected!')
        }
      })

      this.sock.ev.on('messages.upsert', async (m: any) => {
        if (m.type !== 'notify') return

        for (const msg of m.messages) {
          if (msg.key.fromMe || !msg.key.remoteJid || msg.key.remoteJid.includes('@g.us')) continue

          const fromJid = msg.key.remoteJid
          const from = fromJid.split('@')[0]

          // Allow any phone number to interact with the bot

          // Extract message content in case of ephemeral or viewOnce wrappers
          let messageContent = msg.message
          if (messageContent?.ephemeralMessage) {
            messageContent = messageContent.ephemeralMessage.message
          }
          if (messageContent?.viewOnceMessage) {
            messageContent = messageContent.viewOnceMessage.message
          }
          if (messageContent?.viewOnceMessageV2) {
            messageContent = messageContent.viewOnceMessageV2.message
          }

          const body = messageContent?.conversation || messageContent?.extendedTextMessage?.text
          const audioMessage = messageContent?.audioMessage

          if (!body && !audioMessage) continue

          console.log(`[SITME WhatsApp] Received from ${from}: body=${body}, hasAudio=${!!audioMessage}`)

          try {
            let messageText = body || ''
            if (audioMessage) {
              console.log(`[SITME WhatsApp] Downloading audio message from ${from}...`)
              const buffer = await downloadMediaMessage(
                msg,
                'buffer',
                {},
                {
                  logger: pino({ level: 'silent' }),
                  reuploadRequest: async (m: any) => m,
                }
              )
              console.log(`[SITME WhatsApp] Audio downloaded, size: ${buffer.length} bytes. Transcribing...`)
              const transcription = await this.transcribeAudio(buffer)
              console.log(`[SITME WhatsApp] Transcription result: "${transcription}"`)
              messageText = transcription
            }

            if (!messageText) continue

            const reply = await this.processMessage(from, messageText, !!audioMessage)
            
            // If they sent an audio message, prepend the transcription so they see what we heard
            let finalReply = reply
            if (audioMessage) {
              finalReply = `🎤 *Audio transcribido:* "${messageText}"\n\n${reply}`
            }

            await this.sock.sendMessage(fromJid, { text: finalReply })
            console.log(`[SITME WhatsApp] Replied to ${from}`)
          } catch (err) {
            console.error('[SITME WhatsApp] Error sending message via Baileys:', err)
          }
        }
      })

    } catch (error: any) {
      this.status = 'ERROR'
      this.errorMessage = error?.message || 'Baileys initialization error'
      console.error('[SITME WhatsApp] Failed to start Baileys:', this.errorMessage)
    }
  }

  public async shutdown() {
    if (this.sock) {
      console.log('[SITME WhatsApp] Closing Baileys socket connection...')
      try {
        await this.sock.end(undefined)
      } catch (err) {
        console.error('[SITME WhatsApp] Error closing socket:', err)
      }
      this.sock = null
      this.status = 'DISCONNECTED'
    }
  }

  private async processMessage(from: string, body: string, isAudio: boolean = false): Promise<string> {
    let chat = await WhatsappChat.findBy('phoneNumber', from)
    if (!chat) {
      chat = new WhatsappChat()
      chat.phoneNumber = from
      chat.parsedContext = { step: 'welcome', messages: [] }
    }

    const context = chat.parsedContext
    if (!Array.isArray(context.messages)) {
      context.messages = []
    }

    // Append user message
    context.messages.push({
      sender: 'user',
      text: body,
      timestamp: new Date().toISOString(),
      isAudio
    })

    const stations = await Station.query()
    const routes = await Route.query().preload('routeStations', (q) => q.preload('station').orderBy('sequenceOrder', 'asc'))
    const buses = await Bus.query().preload('route')
    const arrivals = await Arrival.query().preload('bus').preload('station')

    let reply = ''
    const geminiKey = env.get('GEMINI_API_KEY')

    if (geminiKey) {
      reply = await this.generateGeminiResponse(geminiKey, body, context, stations, routes, buses, arrivals)
    } else {
      reply = this.generateLocalResponse(body, context, stations)
    }

    // Append bot response
    context.messages.push({
      sender: 'bot',
      text: reply,
      timestamp: new Date().toISOString()
    })

    context.lastMessage = body
    chat.lastMessage = body
    chat.parsedContext = context
    await chat.save()

    return reply
  }

  private async generateGeminiResponse(
    apiKey: string,
    message: string,
    context: any,
    stations: Station[],
    routes: Route[],
    buses: Bus[],
    arrivals: Arrival[]
  ): Promise<string> {
    const systemPrompt = `Eres SITME (Sistema Sinérgico SITME), el asistente virtual inteligente de Metrolínea en Bucaramanga.
Tu objetivo es guiar a los pasajeros de manera eficiente e informada, ayudándoles a evitar el hacinamiento en las estaciones y autobuses.

DATOS EN TIEMPO REAL DEL SISTEMA METROLÍNEA:
- Estaciones:
${stations.map((s) => `  * ${s.name}: Ocupación ${s.occupancyLevel} (${s.passengerCount} personas)`).join('\n')}

- Rutas:
${routes.map((r) => `  * Ruta ${r.name} (${r.description}): Paradas -> ${r.routeStations.map((rs) => rs.station.name).join(' ➔ ')}`).join('\n')}

- Buses:
${buses.map((b) => `  * Bus ${b.plate} (Ruta ${b.route ? b.route.name : 'Ninguna'}): Ocupación ${b.occupancyLevel}, Estado: ${b.status}`).join('\n')}

- ETA:
${arrivals.map((a) => `  * Bus ${a.bus.plate} llegará a ${a.station.name} en ${a.etaMinutes} minutos. (${a.bus.occupancyLevel})`).join('\n')}

REGLAS:
1. Responde amable, claro y corto (con emojis).
2. Si preguntan ruta, sugiere la indicada según paradas.
3. Si un bus viene lleno (HIGH) en 2 min y otro viene vacío/medio en 10-15 min, recomienda esperar el segundo.
4. Ofrece activar alerta del bus seleccionado.`

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: message }] }],
            systemInstruction: { parts: [{ text: systemPrompt }] },
            generationConfig: { temperature: 0.3, maxOutputTokens: 400 },
          }),
        }
      )
      if (!response.ok) return this.generateLocalResponse(message, context, stations)
      const data = await response.json()
      return (data as any).candidates[0].content.parts[0].text
    } catch {
      return this.generateLocalResponse(message, context, stations)
    }
  }

  private generateLocalResponse(
    message: string,
    context: any,
    stations: Station[]
  ): string {
    const text = message.toLowerCase()
    if (text.includes('hola') || text.includes('buenas')) {
      context.step = 'greeted'
      return `👋 ¡Hola! Soy el asistente virtual de Metrolínea (SITME). 🤖
Te ayudo a consultar rutas, ver la ocupación en tiempo real y evitar buses llenos.

¿En qué estación te encuentras actualmente y hacia dónde te diriges? (Ej: "Estoy en Provenza Occidental y voy a La Rosita")`
    }
    if (text.includes('provenza') && text.includes('rosita')) {
      context.step = 'route_info'
      return `📍 *Desde Estación Provenza Occidental hacia La Rosita:*

La mejor opción es tomar la ruta troncal *PTB* o *PTN*. Debes bajarte en la *Estación La Rosita* (Diagonal 15).

Actualmente, estos son los próximos buses de la ruta *PTB* acercándose a Provenza Occidental:
🔴 *Bus BUS-101* (llegando en *2 minutos*): Nivel de aglomeración *ALTO* (bastante lleno, sin sillas).
🟢 *Bus BUS-102* (llegando en *12 minutos*): Nivel de aglomeración *BAJO* (sillas disponibles).

⚠️ *Recomendación SITME:* Te sugerimos esperar 10 minutos más y tomar el bus *BUS-102* para viajar cómodo y ayudar a descongestionar el sistema.

¿Te gustaría que te envíe un recordatorio cuando el bus menos aglomerado esté a una estación de distancia? (Responde: "Sí, activar alerta")`
    }
    if (text.includes('alerta') || text.includes('sí') || text.includes('si')) {
      if (context.step === 'route_info') {
        context.step = 'alert_active'
        return `🔔 ¡Alerta activada! Te notificaré cuando el bus *BUS-102* (ocupación baja) esté pasando por la Estación Diamante (a 1 estación de distancia de ti). ¡Gracias por viajar inteligente! 🚌✨`
      }
    }
    if (text.includes('ocupacion') || text.includes('estado') || text.includes('estacion') || text.includes('estación')) {
      let responseText = `📊 *Ocupación de Estaciones en Tiempo Real:* \n\n`
      stations.forEach((s) => {
        const emoji = s.occupancyLevel === 'HIGH' ? '🔴' : s.occupancyLevel === 'MEDIUM' ? '🟡' : '🟢'
        responseText += `${emoji} *${s.name}*: ${s.occupancyLevel} (${s.passengerCount} pasajeros)\n`
      })
      responseText += `\n¿Quieres saber qué bus viene a alguna estación? Escribe el nombre de la estación.`
      return responseText
    }
    return `🤖 *SITME Metrolínea:* Entiendo que estás consultando sobre el sistema.
Puedes preguntarme cosas como:
• "Estoy en Provenza y voy a La Rosita" (para buscar rutas y evitar aglomeraciones).
• "Estado de las estaciones" (para ver ocupación en tiempo real).
• "Ver buses" (para ver la flota activa).

    Dime, ¿cómo te puedo ayudar hoy?`
  }

  private async transcribeAudio(buffer: Buffer): Promise<string> {
    const openaiKey = env.get('OPENAI_API_KEY')
    const geminiKey = env.get('GEMINI_API_KEY')

    if (openaiKey) {
      try {
        console.log('[SITME WhatsApp] Transcribing with OpenAI Whisper...')
        return await this.transcribeOpenAI(openaiKey, buffer)
      } catch (err) {
        console.error('[SITME WhatsApp] OpenAI transcription failed:', err)
      }
    }

    if (geminiKey) {
      try {
        console.log('[SITME WhatsApp] Transcribing with Gemini...')
        return await this.transcribeGemini(geminiKey, buffer)
      } catch (err) {
        console.error('[SITME WhatsApp] Gemini transcription failed:', err)
      }
    }

    console.log('[SITME WhatsApp] No API keys configured or transcription failed. Returning mock transcription.')
    return '¿Cómo llego de Provenza a La Rosita?'
  }

  private async transcribeOpenAI(apiKey: string, buffer: Buffer): Promise<string> {
    const formData = new FormData()
    const blob = new Blob([new Uint8Array(buffer)], { type: 'audio/ogg' })
    formData.append('file', blob, 'audio.ogg')
    formData.append('model', 'whisper-1')
    formData.append('language', 'es')

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: formData,
    })

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`OpenAI Whisper API error: ${response.status} ${errText}`)
    }

    const data: any = await response.json()
    return data.text || ''
  }

  private async transcribeGemini(apiKey: string, buffer: Buffer): Promise<string> {
    const base64Audio = buffer.toString('base64')
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  inlineData: {
                    mimeType: 'audio/ogg',
                    data: base64Audio,
                  },
                },
                {
                  text: 'Transcribe exactamente el siguiente audio en español de la forma más precisa posible. Si el audio no tiene voz o no se entiende, devuelve vacío. Devuelve ÚNICAMENTE la transcripción literal, sin comentarios, aclaraciones ni introducciones.',
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.0,
          },
        }),
      }
    )

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`Gemini Transcription API error: ${response.status} ${errText}`)
    }

    const data: any = await response.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text
    return text ? text.trim() : ''
  }
}
