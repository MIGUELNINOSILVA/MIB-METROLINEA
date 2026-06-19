import { StationSchema } from '#database/schema'
import { hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import RouteStation from '#models/route_station'
import Arrival from '#models/arrival'

export default class Station extends StationSchema {
  @hasMany(() => RouteStation)
  declare routeStations: HasMany<typeof RouteStation>

  @hasMany(() => Arrival)
  declare arrivals: HasMany<typeof Arrival>
}
