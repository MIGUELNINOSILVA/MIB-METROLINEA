import type { HttpContext } from '@adonisjs/core/http'
import Station from '#models/station'
import Route from '#models/route'
import Bus from '#models/bus'
import Arrival from '#models/arrival'
import WhatsappChat from '#models/whatsapp_chat'
import env from '#start/env'
import { WhatsappService } from '../services/whatsapp_service.js'


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
    // Phone restriction removed as requested

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
   * Clear chat history
   */
  async destroy({ params, response }: HttpContext) {
    const phone = params.phone

    const chat = await WhatsappChat.findBy('phoneNumber', phone)
    if (chat) {
      await chat.delete()
    }

    return response.json({ message: 'Chat history cleared' })
  }

  /**
   * Internal shared handler for incoming messages
   */
  private async handleIncomingMessage(
    from: string,
    body: string,
    isAudio: boolean = false,
    userLatitude?: number,
    userLongitude?: number
  ) {
    // 1. Get or create chat context
    let chat = await WhatsappChat.findBy('phoneNumber', from)
    if (!chat) {
      chat = new WhatsappChat()
      chat.phoneNumber = from
      chat.parsedContext = {
        step: 'welcome',
        userLatitude: userLatitude !== undefined ? userLatitude : 7.0945,
        userLongitude: userLongitude !== undefined ? userLongitude : -73.1118,
        messages: [],
      }
    } else {
      const context = chat.parsedContext
      if (userLatitude !== undefined) context.userLatitude = userLatitude
      if (userLongitude !== undefined) context.userLongitude = userLongitude
      chat.parsedContext = context
    }

    const context = chat.parsedContext
    if (!Array.isArray(context.messages)) {
      context.messages = []
    }
    if (!context.userLatitude) {
      context.userLatitude = 7.0945
      context.userLongitude = -73.1118
    }

    // Append incoming user message
    context.messages.push({
      sender: 'user',
      text: body,
      timestamp: new Date().toISOString(),
      isAudio
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
      reply = this.generateLocalResponse(body, context, stations, buses)
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
    const { from, body, isAudio, latitude, longitude } = request.only(['from', 'body', 'isAudio', 'latitude', 'longitude'])

    if (!from || !body) {
      return response.status(400).json({ error: 'Missing from or body parameters' })
    }

    // Phone restriction removed as requested

    const { reply } = await this.handleIncomingMessage(
      from,
      body,
      !!isAudio,
      latitude !== undefined ? parseFloat(latitude) : undefined,
      longitude !== undefined ? parseFloat(longitude) : undefined
    )

    return response.json({
      from,
      reply,
    })
  }

  /**
   * Simulated message endpoint (for testing/frontend demo)
   */
  async simulate({ request, response }: HttpContext) {
    const { from, body, isAudio, latitude, longitude } = request.only(['from', 'body', 'isAudio', 'latitude', 'longitude'])
    if (!from || !body) {
      return response.status(400).json({ error: 'Missing from or body parameters' })
    }

    // Phone restriction removed as requested

    const { reply, chat } = await this.handleIncomingMessage(
      from,
      body,
      !!isAudio,
      latitude !== undefined ? parseFloat(latitude) : undefined,
      longitude !== undefined ? parseFloat(longitude) : undefined
    )

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
    const userLat = context.userLatitude || 7.0945
    const userLon = context.userLongitude || -73.1118

    const systemPrompt = `Eres SITME (Sistema Sinérgico SITME), el asistente virtual inteligente de Metrolínea en Bucaramanga.
Tu objetivo es guiar a los pasajeros de manera eficiente e informada, ayudándoles a evitar el hacinamiento en las estaciones y autobuses.

COORDENADAS DEL USUARIO ACTUAL (TELEMETRÍA):
- Latitud: ${userLat}
- Longitud: ${userLon}

DATOS EN TIEMPO REAL DEL SISTEMA METROLÍNEA (TELEMETRÍA GPS):
- Estaciones:
${stations.map((s) => `  * ${s.name}: Ocupación ${s.occupancyLevel} (${s.passengerCount} personas), Coordenadas: Lat ${s.latitude || 'Sin especificar'}, Lon ${s.longitude || 'Sin especificar'}`).join('\n')}

- Rutas y sus paradas:
${routes
  .map(
    (r) =>
      `  * Ruta ${r.name} (${r.description}): Paradas en orden -> ${r.routeStations.map((rs) => rs.station.name).join(' ➔ ')}`
  )
  .join('\n')}

- Estado y Ubicación de los Buses:
${buses.map((b) => `  * Bus ${b.plate} (Ruta ${b.route ? b.route.name : 'Ninguna'}): Ocupación ${b.occupancyLevel}, Estado: ${b.status}, Coordenadas: Lat ${b.latitude || 'Sin especificar'}, Lon ${b.longitude || 'Sin especificar'}`).join('\n')}

- Próximos Arribos a Estaciones (ETA):
${arrivals.map((a) => `  * Bus ${a.bus.plate} llegará a ${a.station.name} en ${a.etaMinutes} minutos. (Ocupación del bus: ${a.bus.occupancyLevel})`).join('\n')}

REGLAS DE RESPUESTA:
1. Responde en español de forma amable, clara y concisa (idealmente en 2-4 párrafos máximo, usando emojis).
2. Si el usuario te pregunta cómo llegar desde una estación de origen a un destino, sugiere qué rutas le sirven basándote en la lista de paradas.
3. Si el usuario consulta la ubicación o distancia de un bus o transporte, calcula la distancia desde la ubicación del usuario (${userLat}, ${userLon}) usando la fórmula de Haversine:
   d = 2 * R * asin(sqrt(sin^2(dLat/2) + cos(lat1)*cos(lat2)*sin^2(dLon/2))) con R = 6371 km.
   Estima el tiempo de arribo (ETA) como: ETA = distancia * 2 minutos.
   Reporta siempre explícitamente las coordenadas del bus, la distancia en km (con 1 decimal) y el tiempo aproximado (ETA) de llegada en minutos.
4. Sinergia contra Aglomeración (Crucial): Si un bus está a punto de llegar (o está muy cerca por distancia) pero está LLENO (occupancyLevel HIGH), y viene otro bus de la misma ruta poco después que está VACÍO o MEDIO (occupancyLevel LOW o MEDIUM), adviértele explícitamente y recomiéndale esperar el segundo bus para viajar más cómodo.
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
        return this.generateLocalResponse(message, context, stations, buses)
      }

      const data = await response.json()
      return (data as any).candidates[0].content.parts[0].text
    } catch (error) {
      console.error('Failed to contact Gemini API:', error)
      return this.generateLocalResponse(message, context, stations, buses)
    }
  }

  /**
   * Fallback rule-based conversational responses (doesn't require API key, perfect for offline/local run)
   */
  private generateLocalResponse(
    message: string,
    context: any,
    stations: Station[],
    buses: Bus[]
  ): string {
    const text = message.toLowerCase()
    const userLat = context.userLatitude || 7.0945
    const userLon = context.userLongitude || -73.1118

    // Haversine Distance helper
    const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
      const R = 6371 // km
      const dLat = ((lat2 - lat1) * Math.PI) / 180
      const dLon = ((lon2 - lon1) * Math.PI) / 180
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
          Math.cos((lat2 * Math.PI) / 180) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2)
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
      return Math.round(R * c * 10) / 10
    }

    // 1. Telemetry Query
    if (
      text.includes('bus') ||
      text.includes('buses') ||
      text.includes('dónde viene') ||
      text.includes('donde viene') ||
      text.includes('distancia') ||
      text.includes('telemetria') ||
      text.includes('telemetría') ||
      text.includes('ubicacion') ||
      text.includes('ubicación')
    ) {
      let responseText = `🚌 *Telemetría y Estado de la Flota en Tiempo Real:* \n\n`
      responseText += `📍 *Tu ubicación:* Lat ${userLat}, Lon ${userLon}\n\n`

      buses.forEach((b) => {
        const busLat = b.latitude || 7.0945
        const busLon = b.longitude || -73.1118
        const dist = getDistance(userLat, userLon, busLat, busLon)
        const eta = Math.round(dist * 2)
        const emoji = b.occupancyLevel === 'HIGH' ? '🔴' : b.occupancyLevel === 'MEDIUM' ? '🟡' : '🟢'

        responseText += `🚌 *Bus ${b.plate}* (Ruta: ${b.route ? b.route.name : 'Ninguna'}):\n`
        responseText += `  • Aforo/Ocupación: ${emoji} *${b.occupancyLevel}* (${b.passengerCount} pasajeros)\n`
        responseText += `  • Ubicación: Lat ${busLat}, Lon ${busLon}\n`
        responseText += `  • Distancia: *${dist} km*\n`
        responseText += `  • Tiempo Estimado (ETA): *${eta} minutos*\n`
        responseText += `  • Estado: ${b.status === 'IN_TRANSIT' ? '🟢 En tránsito' : '🔴 Detenido'}\n\n`
      })

      // Synergy logic in fallback
      const activePtbBuses = buses.filter(b => b.route && b.route.name === 'PTB')
      if (activePtbBuses.length >= 2) {
        const sortedBuses = activePtbBuses.map(b => {
          const busLat = b.latitude || 7.0945
          const busLon = b.longitude || -73.1118
          const dist = getDistance(userLat, userLon, busLat, busLon)
          return { ...b, dist, eta: Math.round(dist * 2) }
        }).sort((x, y) => x.dist - y.dist)

        const first = sortedBuses[0]
        const second = sortedBuses[1]
        if (first.occupancyLevel === 'HIGH' && (second.occupancyLevel === 'LOW' || second.occupancyLevel === 'MEDIUM')) {
          responseText += `\n⚠️ *Recomendación SITME (Sinergia):* El bus más cercano *${first.plate}* (${first.eta} min) viene *LLENO*. Te recomendamos esperar al bus *${second.plate}* que viene a ${second.eta} min con ocupación *${second.occupancyLevel}*.\n`
        }
      }

      responseText += `\n¿Te gustaría que te envíe un recordatorio cuando el bus menos aglomerado esté cerca?`
      return responseText
    }

    // 2. Greet
    if (text.includes('hola') || text.includes('buenas') || text.includes('buenos')) {
      context.step = 'greeted'
      return `👋 ¡Hola! Soy el asistente virtual de Metrolínea (SITME). 🤖
Te ayudo a consultar rutas, ver la ocupación en tiempo real y evitar buses llenos.

¿En qué estación te encuentras actualmente y hacia dónde te diriges? (Ej: "Estoy en Provenza Occidental y voy a La Rosita")`
    }

    // 3. Identify locations (Provenza and La Rosita)
    const isProvenza = text.includes('provenza')
    const isRosita = text.includes('rosita')

    if (isProvenza && isRosita) {
      context.step = 'route_info'

      // Calculate dynamic distances to buses
      const activePtbBuses = buses.filter(b => b.route && b.route.name === 'PTB')
      let firstBusText = `🔴 *Bus BUS-101* (llegando en *2 minutos*): Nivel de aglomeración *ALTO* (bastante lleno, sin sillas).`
      let secondBusText = `🟢 *Bus BUS-102* (llegando en *12 minutos*): Nivel de aglomeración *BAJO* (sillas disponibles).`
      let recTime = '10 minutos más'

      if (activePtbBuses.length > 0) {
        const sorted = activePtbBuses.map(b => {
          const busLat = b.latitude || 7.0945
          const busLon = b.longitude || -73.1118
          const dist = getDistance(userLat, userLon, busLat, busLon)
          return { ...b, dist, eta: Math.round(dist * 2) }
        }).sort((x, y) => x.dist - y.dist)

        const b1 = sorted.find(x => x.plate === 'BUS-101')
        const b2 = sorted.find(x => x.plate === 'BUS-102')

        if (b1) {
          const b1Emoji = b1.occupancyLevel === 'HIGH' ? '🔴' : b1.occupancyLevel === 'MEDIUM' ? '🟡' : '🟢'
          firstBusText = `${b1Emoji} *Bus ${b1.plate}* (a *${b1.dist} km* / *${b1.eta} min*): Ocupación *${b1.occupancyLevel}* (${b1.passengerCount} pasajeros).`
        }
        if (b2) {
          const b2Emoji = b2.occupancyLevel === 'HIGH' ? '🔴' : b2.occupancyLevel === 'MEDIUM' ? '🟡' : '🟢'
          secondBusText = `${b2Emoji} *Bus ${b2.plate}* (a *${b2.dist} km* / *${b2.eta} min*): Ocupación *${b2.occupancyLevel}* (${b2.passengerCount} pasajeros).`
          if (b1 && b2) {
            recTime = `${b2.eta - b1.eta} minutos más`
          }
        }
      }

      return `📍 *Desde Estación Provenza Occidental hacia La Rosita:*

La mejor opción es tomar la ruta troncal *PTB* o *PTN*. Debes bajarte en la *Estación La Rosita* (Diagonal 15).

Actualmente, estos son los próximos buses de la ruta *PTB* acercándose a tu ubicación:
${firstBusText}
${secondBusText}

⚠️ *Recomendación SITME:* Te sugerimos esperar ${recTime} y tomar el bus *BUS-102* para viajar cómodo y ayudar a descongestionar el sistema.

¿Te gustaría que te envíe un recordatorio cuando el bus menos aglomerado esté a una estación de distancia? (Responde: "Sí, activar alerta")`
    }

    if (text.includes('alerta') || text.includes('sí') || text.includes('si')) {
      if (context.step === 'route_info') {
        context.step = 'alert_active'
        return `🔔 ¡Alerta activada! Te notificaré cuando el bus *BUS-102* (ocupación baja) esté pasando por la Estación Diamante (a 1 estación de distancia de ti). ¡Gracias por viajar inteligente! 🚌✨`
      }
    }

    // 4. General query about stations
    if (text.includes('ocupacion') || text.includes('estado') || text.includes('estacion') || text.includes('estación')) {
      let responseText = `📊 *Ocupación de Estaciones en Tiempo Real:* \n\n`
      stations.forEach((s) => {
        const emoji = s.occupancyLevel === 'HIGH' ? '🔴' : s.occupancyLevel === 'MEDIUM' ? '🟡' : '🟢'
        responseText += `${emoji} *${s.name}*: ${s.occupancyLevel} (${s.passengerCount} pasajeros) [Ubicación: Lat ${s.latitude || 'N/D'}, Lon ${s.longitude || 'N/D'}]\n`
      })
      responseText += `\n¿Quieres saber qué bus viene a alguna estación o a qué distancia está? Escribe "ver buses".`
      return responseText
    }

    // 5. Default fallback
    return `🤖 *SITME Metrolínea:* Entiendo que estás consultando sobre el sistema.
Puedes preguntarme cosas como:
• "Estoy en Provenza y voy a La Rosita" (para buscar rutas y evitar aglomeraciones).
• "Estado de las estaciones" (para ver ocupación en tiempo real).
• "Ubicación de los buses" (para ver la telemetría y distancias).

Dime, ¿cómo te puedo ayudar hoy?`
  }
}
