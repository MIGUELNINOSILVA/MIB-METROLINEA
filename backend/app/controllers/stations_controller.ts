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
}
