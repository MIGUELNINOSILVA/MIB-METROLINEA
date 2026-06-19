import Station from '#models/station'
import yolo from '#services/yolo_service'
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
      const { readFile } = await import('node:fs/promises')
      const fileBytes = await readFile(imageFile.tmpPath)

      console.log(`[SITME AI] Running local YOLOv8 inference for target: ${targetType} #${targetId}...`)

      const result = await yolo.analyzeImage(fileBytes, `${targetType}-${targetId}`)
      console.log('[SITME AI] Analysis complete. Result:', result)

      const latitudeInput = request.input('latitude')
      const longitudeInput = request.input('longitude')

      let updatedEntity: any = null
      if (targetType === 'station') {
        const station = await Station.findOrFail(targetId)
        station.passengerCount = result.passenger_count
        station.occupancyLevel = result.occupancy_level
        if (latitudeInput !== undefined && latitudeInput !== null && latitudeInput !== '') {
          station.latitude = parseFloat(latitudeInput)
        }
        if (longitudeInput !== undefined && longitudeInput !== null && longitudeInput !== '') {
          station.longitude = parseFloat(longitudeInput)
        }
        await station.save()
        updatedEntity = station
      } else if (targetType === 'bus') {
        const Bus = (await import('#models/bus')).default
        const bus = await Bus.findOrFail(targetId)
        bus.passengerCount = result.passenger_count
        bus.occupancyLevel = result.occupancy_level
        if (latitudeInput !== undefined && latitudeInput !== null && latitudeInput !== '') {
          bus.latitude = parseFloat(latitudeInput)
        }
        if (longitudeInput !== undefined && longitudeInput !== null && longitudeInput !== '') {
          bus.longitude = parseFloat(longitudeInput)
        }
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
