import Bus from '#models/bus'
import type { HttpContext } from '@adonisjs/core/http'

export default class BusesController {
  async index({ response }: HttpContext) {
    const buses = await Bus.query().preload('route').preload('arrivals', (query) => {
      query.preload('station')
    })
    return response.json(buses)
  }

  async update({ params, request, response }: HttpContext) {
    const bus = await Bus.findOrFail(params.id)
    const { occupancyLevel, passengerCount, status, latitude, longitude } = request.only([
      'occupancyLevel',
      'passengerCount',
      'status',
      'latitude',
      'longitude',
    ])

    if (occupancyLevel) {
      bus.occupancyLevel = occupancyLevel
    }
    if (passengerCount !== undefined) {
      bus.passengerCount = passengerCount
    }
    if (status) {
      bus.status = status
    }
    if (latitude !== undefined && latitude !== null && latitude !== '') {
      bus.latitude = parseFloat(latitude)
    }
    if (longitude !== undefined && longitude !== null && longitude !== '') {
      bus.longitude = parseFloat(longitude)
    }

    await bus.save()

    return response.json({
      message: 'Bus status updated successfully',
      bus,
    })
  }

  async eta({ params, request, response }: HttpContext) {
    const bus = await Bus.findOrFail(params.id)
    const { stationId, etaMinutes, latitude, longitude } = request.only([
      'stationId',
      'etaMinutes',
      'latitude',
      'longitude',
    ])

    if (!stationId) {
      return response.status(400).json({ error: 'stationId es requerido' })
    }
    if (etaMinutes === undefined || etaMinutes === null || etaMinutes === '') {
      return response.status(400).json({ error: 'etaMinutes es requerido' })
    }

    if (latitude !== undefined && latitude !== null && latitude !== '') {
      bus.latitude = parseFloat(latitude)
    }
    if (longitude !== undefined && longitude !== null && longitude !== '') {
      bus.longitude = parseFloat(longitude)
    }
    await bus.save()

    const Arrival = (await import('#models/arrival')).default
    const arrival = await Arrival.updateOrCreate(
      { busId: bus.id, stationId: Number(stationId) },
      {
        busId: bus.id,
        stationId: Number(stationId),
        etaMinutes: Math.round(Number(etaMinutes)),
      }
    )

    return response.json({
      message: 'ETA registrado correctamente',
      arrival,
      bus,
    })
  }
}
