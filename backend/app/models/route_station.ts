import { RouteStationSchema } from '#database/schema'
import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Route from '#models/route'
import Station from '#models/station'

export default class RouteStation extends RouteStationSchema {
  @belongsTo(() => Route)
  declare route: BelongsTo<typeof Route>

  @belongsTo(() => Station)
  declare station: BelongsTo<typeof Station>
}
