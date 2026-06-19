import Station from '#models/station'
import type { HttpContext } from '@adonisjs/core/http'

export default class StationsController {
  async index({ response }: HttpContext) {
    const stations = await Station.query().preload('arrivals', (query) => {
      query.preload('bus')
    })
    return response.json(stations)
  }

  async update({ params, request, response }: HttpContext) {
    const station = await Station.findOrFail(params.id)
    const { occupancyLevel, passengerCount } = request.only(['occupancyLevel', 'passengerCount'])

    if (occupancyLevel) {
      station.occupancyLevel = occupancyLevel
    }
    if (passengerCount !== undefined) {
      station.passengerCount = passengerCount
    }

    await station.save()

    // Simulate updating arrivals based on new occupancy (optional, ponytail: keep it simple)
    return response.json({
      message: 'Station occupancy updated successfully',
      station,
    })
  }

  async analyze({ request, response }: HttpContext) {
    const imageFile = request.file('image', {
      size: '10mb',
      extnames: ['jpg', 'jpeg', 'png', 'webp']
    })

    if (!imageFile || !imageFile.tmpPath) {
      return response.status(400).json({ error: 'No image uploaded' })
    }

    const targetType = request.input('targetType') // 'station' or 'bus'
    const targetId = request.input('targetId')

    if (!targetType || !targetId) {
      return response.status(400).json({ error: 'Missing targetType or targetId' })
    }

    try {
      const { readFileSync } = await import('node:fs')
      const fileBytes = readFileSync(imageFile.tmpPath)
      const blob = new Blob([new Uint8Array(fileBytes)], { type: imageFile.headers['content-type'] || 'image/jpeg' })

      const formData = new FormData()
      formData.append('file', blob, imageFile.clientName || 'upload.jpg')
      formData.append('bus_id', `${targetType}-${targetId}`)
      formData.append('save_to_dataset', 'true')

      console.log(`[SITME AI] Forwarding image to FastAPI server for target: ${targetType} #${targetId}...`)

      const apiResponse = await fetch('http://127.0.0.1:8000/analyze/image', {
        method: 'POST',
        body: formData,
      })

      if (!apiResponse.ok) {
        const errText = await apiResponse.text()
        console.error('[SITME AI] FastAPI error response:', errText)
        return response.status(502).json({ error: `AI Server Error: ${errText}` })
      }

      const result: any = await apiResponse.json()
      console.log('[SITME AI] Analysis complete. Result:', result)

      let updatedEntity: any = null
      if (targetType === 'station') {
        const station = await Station.findOrFail(targetId)
        station.passengerCount = result.passenger_count
        station.occupancyLevel = result.occupancy_level
        await station.save()
        updatedEntity = station
      } else if (targetType === 'bus') {
        const Bus = (await import('#models/bus')).default
        const bus = await Bus.findOrFail(targetId)
        bus.passengerCount = result.passenger_count
        bus.occupancyLevel = result.occupancy_level
        await bus.save()
        updatedEntity = bus
      }

      return response.json({
        success: true,
        result,
        entity: updatedEntity,
      })
    } catch (err: any) {
      console.error('[SITME AI] Analysis failed:', err)
      return response.status(500).json({ error: `Failed to process image with AI: ${err.message}` })
    }
  }
}
