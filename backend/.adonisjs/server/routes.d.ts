import '@adonisjs/core/types/http'

type ParamValue = string | number | bigint | boolean

export type ScannedRoutes = {
  ALL: {
    'auth.new_account.store': { paramsTuple?: []; params?: {} }
    'auth.access_tokens.store': { paramsTuple?: []; params?: {} }
    'profile.profile.show': { paramsTuple?: []; params?: {} }
    'profile.access_tokens.destroy': { paramsTuple?: []; params?: {} }
    'stations.index': { paramsTuple?: []; params?: {} }
    'stations.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'routes.index': { paramsTuple?: []; params?: {} }
    'buses.index': { paramsTuple?: []; params?: {} }
    'buses.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'whatsapp.index': { paramsTuple?: []; params?: {} }
    'whatsapp.status': { paramsTuple?: []; params?: {} }
    'whatsapp.webhook': { paramsTuple?: []; params?: {} }
    'whatsapp.simulate': { paramsTuple?: []; params?: {} }
  }
  GET: {
    'profile.profile.show': { paramsTuple?: []; params?: {} }
    'stations.index': { paramsTuple?: []; params?: {} }
    'routes.index': { paramsTuple?: []; params?: {} }
    'buses.index': { paramsTuple?: []; params?: {} }
    'whatsapp.index': { paramsTuple?: []; params?: {} }
    'whatsapp.status': { paramsTuple?: []; params?: {} }
  }
  HEAD: {
    'profile.profile.show': { paramsTuple?: []; params?: {} }
    'stations.index': { paramsTuple?: []; params?: {} }
    'routes.index': { paramsTuple?: []; params?: {} }
    'buses.index': { paramsTuple?: []; params?: {} }
    'whatsapp.index': { paramsTuple?: []; params?: {} }
    'whatsapp.status': { paramsTuple?: []; params?: {} }
  }
  POST: {
    'auth.new_account.store': { paramsTuple?: []; params?: {} }
    'auth.access_tokens.store': { paramsTuple?: []; params?: {} }
    'profile.access_tokens.destroy': { paramsTuple?: []; params?: {} }
    'whatsapp.webhook': { paramsTuple?: []; params?: {} }
    'whatsapp.simulate': { paramsTuple?: []; params?: {} }
  }
  PUT: {
    'stations.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'buses.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
}
declare module '@adonisjs/core/types/http' {
  export interface RoutesList extends ScannedRoutes {}
}