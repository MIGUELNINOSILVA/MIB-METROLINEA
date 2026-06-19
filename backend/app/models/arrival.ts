import { ArrivalSchema } from '#database/schema'
import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Bus from '#models/bus'
import Station from '#models/station'

export default class Arrival extends ArrivalSchema {
  @belongsTo(() => Bus)
  declare bus: BelongsTo<typeof Bus>

  @belongsTo(() => Station)
  declare station: BelongsTo<typeof Station>
}
