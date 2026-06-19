import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'route_stations'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table
        .integer('route_id')
        .notNullable()
        .unsigned()
        .references('id')
        .inTable('routes')
        .onDelete('CASCADE')
      table
        .integer('station_id')
        .notNullable()
        .unsigned()
        .references('id')
        .inTable('stations')
        .onDelete('CASCADE')
      table.integer('sequence_order').notNullable().defaultTo(1)

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
