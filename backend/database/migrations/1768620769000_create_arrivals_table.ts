import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'arrivals'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table
        .integer('bus_id')
        .notNullable()
        .unsigned()
        .references('id')
        .inTable('buses')
        .onDelete('CASCADE')
      table
        .integer('station_id')
        .notNullable()
        .unsigned()
        .references('id')
        .inTable('stations')
        .onDelete('CASCADE')
      table.integer('eta_minutes').notNullable().defaultTo(0)

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
