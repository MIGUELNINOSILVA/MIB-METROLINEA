import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'stations'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table.string('name').notNullable()
      table.string('location').nullable()
      table.string('occupancy_level').notNullable().defaultTo('LOW') // LOW, MEDIUM, HIGH
      table.integer('passenger_count').notNullable().defaultTo(0)

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
