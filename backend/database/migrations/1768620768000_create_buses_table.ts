import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'buses'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table.string('plate').notNullable().unique()
      table
        .integer('route_id')
        .nullable()
        .unsigned()
        .references('id')
        .inTable('routes')
        .onDelete('SET NULL')
      table.string('occupancy_level').notNullable().defaultTo('LOW') // LOW, MEDIUM, HIGH
      table.integer('passenger_count').notNullable().defaultTo(0)
      table.string('status').notNullable().defaultTo('IN_TRANSIT') // IN_TRANSIT, STOPPED, OUT_OF_SERVICE
      table.double('latitude').nullable()
      table.double('longitude').nullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
