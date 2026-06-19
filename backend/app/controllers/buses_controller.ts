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
    const { occupancyLevel, passengerCount, status } = request.only([
      'occupancyLevel',
      'passengerCount',
      'status',
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

    await bus.save()

    return response.json({
      message: 'Bus status updated successfully',
      bus,
    })
  }
}
