import Route from '#models/route'
import type { HttpContext } from '@adonisjs/core/http'

export default class RoutesController {
  async index({ response }: HttpContext) {
    const routes = await Route.query()
      .preload('routeStations', (query) => {
        query.preload('station').orderBy('sequenceOrder', 'asc')
      })
      .preload('buses')
    return response.json(routes)
  }
}
