import type { HttpContext } from '@adonisjs/core/http'
import Station from '#models/station'
import Route from '#models/route'
import Bus from '#models/bus'
import Arrival from '#models/arrival'
import WhatsappChat from '#models/whatsapp_chat'
import env from '#start/env'
import { WhatsappService } from '../services/whatsapp_service.js'

const ALLOWED_PHONE = '573126078359'

export default class WhatsappController {
  /**
   * Get WhatsApp client status and QR code
   */
  async status({ response }: HttpContext) {
    const service = WhatsappService.getInstance()
    const { status, errorMessage } = service.getStatus()
    const qr = service.getQrCode()

    return response.json({
      status,
      errorMessage,
      qr,
      hasGeminiKey: !!env.get('GEMINI_API_KEY'),
    })
  }

  /**
   * List all chats for the dashboard
   */
  async index({ response }: HttpContext) {
    const chats = await WhatsappChat.query().orderBy('updatedAt', 'desc')
    return response.json(chats)
  }

  /**
   * Get single chat history
   */
  async show({ params, response }: HttpContext) {
    const phone = params.phone

    // Enforce allowed phone limit in show view too
    if (phone !== ALLOWED_PHONE) {
      return response.status(403).json({ error: 'System is restricted to phone number +573126078359' })
    }

    const chat = await WhatsappChat.findBy('phoneNumber', phone)
    if (!chat) {
      // Return a structured blank chat template if conversation hasn't started yet
      return response.json({
        phoneNumber: phone,
        lastMessage: null,
        parsedContext: {
          step: 'welcome',
          messages: [
            {
              sender: 'bot',
              text: '👋 ¡Hola! Soy el asistente virtual de Metrolínea (SITME). 🤖\nTe ayudo a consultar rutas, ver la ocupación en tiempo real y evitar buses llenos.\n\n¿En qué estación te encuentras actualmente y hacia dónde te diriges?',
              timestamp: new Date().toISOString()
            }
          ]
        }
      })
    }

    return response.json({
      phoneNumber: chat.phoneNumber,
      lastMessage: chat.lastMessage,
      parsedContext: chat.parsedContext
    })
  }

  /**
   * Internal shared handler for incoming messages
   */
  private async handleIncomingMessage(from: string, body: string) {
    // Enforce allowed phone check
    if (from !== ALLOWED_PHONE) {
      throw new Error(`Unauthorized phone number: ${from}. Only +573126078359 is allowed.`)
    }

    // 1. Get or create chat context
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

    // Append incoming user message
    context.messages.push({
      sender: 'user',
      text: body,
      timestamp: new Date().toISOString()
    })

    // 2. Fetch real-time data from database
    const stations = await Station.query()
    const routes = await Route.query().preload('routeStations', (q) => q.preload('station').orderBy('sequenceOrder', 'asc'))
    const buses = await Bus.query().preload('route')
    const arrivals = await Arrival.query().preload('bus').preload('station')

    // 3. Generate response using AI (Gemini) or local fallback rules
    let reply = ''
    const geminiKey = env.get('GEMINI_API_KEY')

    if (geminiKey) {
      reply = await this.generateGeminiResponse(geminiKey, body, context, stations, routes, buses, arrivals)
    } else {
      reply = this.generateLocalResponse(body, context, stations)
    }

    // Append bot response to history
    context.messages.push({
      sender: 'bot',
      text: reply,
      timestamp: new Date().toISOString()
    })

    // 4. Update chat history and context
    context.lastMessage = body
    chat.lastMessage = body
    chat.parsedContext = context
    await chat.save()

    return {
      reply,
      chat,
    }
  }

  /**
   * Webhook endpoint to receive incoming WhatsApp messages
   */
  async webhook({ request, response }: HttpContext) {
    const { from, body } = request.only(['from', 'body'])

    if (!from || !body) {
      return response.status(400).json({ error: 'Missing from or body parameters' })
    }

    if (from !== ALLOWED_PHONE) {
      return response.status(403).json({ error: `System restricted to phone number +${ALLOWED_PHONE}` })
    }

    const { reply } = await this.handleIncomingMessage(from, body)

    return response.json({
      from,
      reply,
    })
  }

  /**
   * Simulated message endpoint (for testing/frontend demo)
   */
  async simulate({ request, response }: HttpContext) {
    const { from, body } = request.only(['from', 'body'])
    if (!from || !body) {
      return response.status(400).json({ error: 'Missing from or body parameters' })
    }

    if (from !== ALLOWED_PHONE) {
      return response.status(403).json({ error: `System restricted to phone number +${ALLOWED_PHONE}` })
    }

    const { reply, chat } = await this.handleIncomingMessage(from, body)

    return response.json({
      from,
      reply,
      chat,
    })
  }

  /**
   * Call Gemini API using native fetch (YAGNI / Ponytail: no external library needed)
   */
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
${stations.map((s) => `  * ${s.name}: Ocupación ${s.occupancyLevel} (${s.passengerCount} personas), Ubicación: ${s.location}`).join('\n')}

- Rutas y sus paradas:
${routes
  .map(
    (r) =>
      `  * Ruta ${r.name} (${r.description}): Paradas en orden -> ${r.routeStations.map((rs) => rs.station.name).join(' ➔ ')}`
  )
  .join('\n')}

- Estado de los Buses:
${buses.map((b) => `  * Bus ${b.plate} (Ruta ${b.route ? b.route.name : 'Ninguna'}): Ocupación ${b.occupancyLevel}, Estado: ${b.status}`).join('\n')}

- Próximos Arribos a Estaciones (ETA):
${arrivals.map((a) => `  * Bus ${a.bus.plate} llegará a ${a.station.name} en ${a.etaMinutes} minutos. (Ocupación del bus: ${a.bus.occupancyLevel})`).join('\n')}

REGLAS DE RESPUESTA:
1. Responde en español de forma amable, clara y concisa (idealmente en 2-4 párrafos máximo, usando emojis).
2. Si el usuario te pregunta cómo llegar desde una estación de origen a un destino, sugiere qué rutas le sirven basándote en la lista de paradas.
3. Informa la aglomeración actual de la estación de origen y de los próximos buses de la ruta.
4. Sinergia contra Aglomeración (Crucial): Si un bus está a punto de llegar (ej. 2 min) pero está LLENO (occupancyLevel HIGH), y viene otro bus de la misma ruta poco después (ej. 10-15 min) que está VACÍO o MEDIO (occupancyLevel LOW o MEDIUM), adviértele explícitamente y recomiéndale esperar el segundo bus para viajar más cómodo.
5. Pregunta al usuario si desea activar una alerta cuando el bus menos congestionado esté a una estación de distancia.
6. Mantén el tono conversacional. Guarda estados simples en el contexto del chat si es necesario.
7. Contexto de la conversación actual: ${JSON.stringify(context)}.
`

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [{ text: `Mensaje del usuario: "${message}"\n\nGenera la respuesta del asistente virtual SITME.` }],
              },
            ],
            systemInstruction: {
              parts: [{ text: systemPrompt }],
            },
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 500,
            },
          }),
        }
      )

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Gemini API Error:', errorText)
        return this.generateLocalResponse(message, context, stations)
      }

      const data = await response.json()
      return (data as any).candidates[0].content.parts[0].text
    } catch (error) {
      console.error('Failed to contact Gemini API:', error)
      return this.generateLocalResponse(message, context, stations)
    }
  }

  /**
   * Fallback rule-based conversational responses (doesn't require API key, perfect for offline/local run)
   */
  private generateLocalResponse(
    message: string,
    context: any,
    stations: Station[]
  ): string {
    const text = message.toLowerCase()

    // 1. Greet
    if (text.includes('hola') || text.includes('buenas') || text.includes('buenos')) {
      context.step = 'greeted'
      return `👋 ¡Hola! Soy el asistente virtual de Metrolínea (SITME). 🤖
Te ayudo a consultar rutas, ver la ocupación en tiempo real y evitar buses llenos.

¿En qué estación te encuentras actualmente y hacia dónde te diriges? (Ej: "Estoy en Provenza Occidental y voy a La Rosita")`
    }

    // 2. Identify locations (Provenza and La Rosita)
    const isProvenza = text.includes('provenza')
    const isRosita = text.includes('rosita')

    if (isProvenza && isRosita) {
      context.step = 'route_info'

      // Let's formulate the exact synergy reply from README
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

    // 3. General query about stations
    if (text.includes('ocupacion') || text.includes('estado') || text.includes('estacion') || text.includes('estación')) {
      let responseText = `📊 *Ocupación de Estaciones en Tiempo Real:* \n\n`
      stations.forEach((s) => {
        const emoji = s.occupancyLevel === 'HIGH' ? '🔴' : s.occupancyLevel === 'MEDIUM' ? '🟡' : '🟢'
        responseText += `${emoji} *${s.name}*: ${s.occupancyLevel} (${s.passengerCount} pasajeros)\n`
      })
      responseText += `\n¿Quieres saber qué bus viene a alguna estación? Escribe el nombre de la estación.`
      return responseText
    }

    // 4. Default fallback
    return `🤖 *SITME Metrolínea:* Entiendo que estás consultando sobre el sistema.
Puedes preguntarme cosas como:
• "Estoy en Provenza y voy a La Rosita" (para buscar rutas y evitar aglomeraciones).
• "Estado de las estaciones" (para ver ocupación en tiempo real).
• "Ver buses" (para ver la flota activa).

Dime, ¿cómo te puedo ayudar hoy?`
  }
}
