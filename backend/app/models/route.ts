import { RouteSchema } from '#database/schema'
import { hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import RouteStation from '#models/route_station'
import Bus from '#models/bus'

export default class Route extends RouteSchema {
  @hasMany(() => RouteStation)
  declare routeStations: HasMany<typeof RouteStation>

  @hasMany(() => Bus)
  declare buses: HasMany<typeof Bus>
}
