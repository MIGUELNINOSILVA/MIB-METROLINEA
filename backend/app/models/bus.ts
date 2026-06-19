import { BusSchema } from '#database/schema'
import { belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import Route from '#models/route'
import Arrival from '#models/arrival'

export default class Bus extends BusSchema {
  @belongsTo(() => Route)
  declare route: BelongsTo<typeof Route>

  @hasMany(() => Arrival)
  declare arrivals: HasMany<typeof Arrival>
}
