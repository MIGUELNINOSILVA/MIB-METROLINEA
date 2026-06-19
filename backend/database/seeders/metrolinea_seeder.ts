import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Station from '#models/station'
import Route from '#models/route'
import RouteStation from '#models/route_station'
import Bus from '#models/bus'
import Arrival from '#models/arrival'
import User from '#models/user'
import hash from '@adonisjs/core/services/hash'

export default class extends BaseSeeder {
  async run() {
    // 1. Create Admin User
    await User.updateOrCreate(
      { email: 'admin@metrolinea.com' },
      {
        fullName: 'Administrador SITME',
        password: await hash.make('admin123'),
      }
    )

    // 2. Create Stations
    const stationsData = [
      { name: 'Estación Provenza Occidental', location: 'Autopista Floridablanca (Costado Occidental)', occupancyLevel: 'HIGH', passengerCount: 120, latitude: 7.0945, longitude: -73.1118 },
      { name: 'Estación Provenza Oriental', location: 'Autopista Floridablanca (Costado Oriental)', occupancyLevel: 'MEDIUM', passengerCount: 65, latitude: 7.0945, longitude: -73.1115 },
      { name: 'Estación Diamante', location: 'Autopista Floridablanca - El Diamante', occupancyLevel: 'LOW', passengerCount: 20, latitude: 7.1018, longitude: -73.1160 },
      { name: 'Estación La Rosita', location: 'Diagonal 15 - Calle 45', occupancyLevel: 'HIGH', passengerCount: 95, latitude: 7.1160, longitude: -73.1235 },
      { name: 'Estación Chorreras', location: 'Carrera 15 - Calle 36', occupancyLevel: 'MEDIUM', passengerCount: 40, latitude: 7.1225, longitude: -73.1265 },
      { name: 'Estación Quebradaseca', location: 'Carrera 15 - Calle 30', occupancyLevel: 'LOW', passengerCount: 15, latitude: 7.1275, longitude: -73.1290 },
      { name: 'Estación UIS', location: 'Carrera 27 - Universidad Industrial de Santander', occupancyLevel: 'HIGH', passengerCount: 150, latitude: 7.1385, longitude: -73.1215 },
    ]

    const stations: Station[] = []
    for (const data of stationsData) {
      const station = await Station.updateOrCreate({ name: data.name }, data)
      stations.push(station)
    }

    const provenzaOcc = stations.find((s) => s.name === 'Estación Provenza Occidental')!
    const provenzaOri = stations.find((s) => s.name === 'Estación Provenza Oriental')!
    const diamante = stations.find((s) => s.name === 'Estación Diamante')!
    const laRosita = stations.find((s) => s.name === 'Estación La Rosita')!
    const chorreras = stations.find((s) => s.name === 'Estación Chorreras')!
    const quebradaseca = stations.find((s) => s.name === 'Estación Quebradaseca')!
    const uis = stations.find((s) => s.name === 'Estación UIS')!

    // 3. Create Routes
    const routesData = [
      { name: 'PTB', description: 'Troncal Provenza - Bucaramanga Centro (por Carrera 15)', schedule: 'L-S 04:30 - 22:30, D-F 06:00 - 21:00' },
      { name: 'PTN', description: 'Troncal Provenza - Norte de Bucaramanga', schedule: 'L-S 05:00 - 21:30' },
      { name: 'T3', description: 'Troncal UIS - Provenza (por Carrera 27)', schedule: 'L-V 05:30 - 21:30' },
    ]

    const routes: Route[] = []
    for (const data of routesData) {
      const route = await Route.updateOrCreate({ name: data.name }, data)
      routes.push(route)
    }

    const ptb = routes.find((r) => r.name === 'PTB')!
    const t3 = routes.find((r) => r.name === 'T3')!

    // 4. Create Route-Station mappings
    // PTB stops: Provenza Occidental -> Diamante -> La Rosita -> Chorreras -> Quebradaseca
    const ptbStops = [
      { routeId: ptb.id, stationId: provenzaOcc.id, sequenceOrder: 1 },
      { routeId: ptb.id, stationId: diamante.id, sequenceOrder: 2 },
      { routeId: ptb.id, stationId: laRosita.id, sequenceOrder: 3 },
      { routeId: ptb.id, stationId: chorreras.id, sequenceOrder: 4 },
      { routeId: ptb.id, stationId: quebradaseca.id, sequenceOrder: 5 },
    ]

    for (const stop of ptbStops) {
      await RouteStation.updateOrCreate(
        { routeId: stop.routeId, stationId: stop.stationId },
        stop
      )
    }

    // T3 stops: Provenza Oriental -> Diamante -> La Rosita -> UIS
    const t3Stops = [
      { routeId: t3.id, stationId: provenzaOri.id, sequenceOrder: 1 },
      { routeId: t3.id, stationId: diamante.id, sequenceOrder: 2 },
      { routeId: t3.id, stationId: laRosita.id, sequenceOrder: 3 },
      { routeId: t3.id, stationId: uis.id, sequenceOrder: 4 },
    ]

    for (const stop of t3Stops) {
      await RouteStation.updateOrCreate(
        { routeId: stop.routeId, stationId: stop.stationId },
        stop
      )
    }

    // 5. Create Buses
    const busesData = [
      { plate: 'BUS-101', routeId: ptb.id, occupancyLevel: 'HIGH', passengerCount: 85, status: 'IN_TRANSIT', latitude: 7.1022, longitude: -73.1163 },
      { plate: 'BUS-102', routeId: ptb.id, occupancyLevel: 'LOW', passengerCount: 15, status: 'IN_TRANSIT', latitude: 7.1180, longitude: -73.1245 },
      { plate: 'BUS-201', routeId: t3.id, occupancyLevel: 'MEDIUM', passengerCount: 45, status: 'IN_TRANSIT', latitude: 7.1350, longitude: -73.1210 },
      { plate: 'BUS-202', routeId: t3.id, occupancyLevel: 'HIGH', passengerCount: 90, status: 'IN_TRANSIT', latitude: 7.1020, longitude: -73.1161 },
    ]

    const buses: Bus[] = []
    for (const data of busesData) {
      const bus = await Bus.updateOrCreate({ plate: data.plate }, data)
      buses.push(bus)
    }

    const bus101 = buses.find((b) => b.plate === 'BUS-101')!
    const bus102 = buses.find((b) => b.plate === 'BUS-102')!
    const bus201 = buses.find((b) => b.plate === 'BUS-201')!

    // 6. Create Arrivals (ETA estimations)
    const arrivalsData = [
      // BUS-101 (PTB - Full)
      { busId: bus101.id, stationId: diamante.id, etaMinutes: 2 },
      { busId: bus101.id, stationId: laRosita.id, etaMinutes: 12 },
      // BUS-102 (PTB - Empty)
      { busId: bus102.id, stationId: diamante.id, etaMinutes: 14 },
      { busId: bus102.id, stationId: laRosita.id, etaMinutes: 24 },
      // BUS-201 (T3 - Medium)
      { busId: bus201.id, stationId: diamante.id, etaMinutes: 4 },
      { busId: bus201.id, stationId: uis.id, etaMinutes: 18 },
    ]

    for (const data of arrivalsData) {
      await Arrival.updateOrCreate(
        { busId: data.busId, stationId: data.stationId },
        data
      )
    }
  }
}
