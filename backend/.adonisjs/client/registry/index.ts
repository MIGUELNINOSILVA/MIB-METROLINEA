/* eslint-disable prettier/prettier */
import type { AdonisEndpoint } from '@tuyau/core/types'
import type { Registry } from './schema.d.ts'
import type { ApiDefinition } from './tree.d.ts'

const placeholder: any = {}

const routes = {
  'auth.new_account.store': {
    methods: ["POST"],
    pattern: '/api/v1/auth/signup',
    tokens: [{"old":"/api/v1/auth/signup","type":0,"val":"api","end":""},{"old":"/api/v1/auth/signup","type":0,"val":"v1","end":""},{"old":"/api/v1/auth/signup","type":0,"val":"auth","end":""},{"old":"/api/v1/auth/signup","type":0,"val":"signup","end":""}],
    types: placeholder as Registry['auth.new_account.store']['types'],
  },
  'auth.access_tokens.store': {
    methods: ["POST"],
    pattern: '/api/v1/auth/login',
    tokens: [{"old":"/api/v1/auth/login","type":0,"val":"api","end":""},{"old":"/api/v1/auth/login","type":0,"val":"v1","end":""},{"old":"/api/v1/auth/login","type":0,"val":"auth","end":""},{"old":"/api/v1/auth/login","type":0,"val":"login","end":""}],
    types: placeholder as Registry['auth.access_tokens.store']['types'],
  },
  'profile.profile.show': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/account/profile',
    tokens: [{"old":"/api/v1/account/profile","type":0,"val":"api","end":""},{"old":"/api/v1/account/profile","type":0,"val":"v1","end":""},{"old":"/api/v1/account/profile","type":0,"val":"account","end":""},{"old":"/api/v1/account/profile","type":0,"val":"profile","end":""}],
    types: placeholder as Registry['profile.profile.show']['types'],
  },
  'profile.access_tokens.destroy': {
    methods: ["POST"],
    pattern: '/api/v1/account/logout',
    tokens: [{"old":"/api/v1/account/logout","type":0,"val":"api","end":""},{"old":"/api/v1/account/logout","type":0,"val":"v1","end":""},{"old":"/api/v1/account/logout","type":0,"val":"account","end":""},{"old":"/api/v1/account/logout","type":0,"val":"logout","end":""}],
    types: placeholder as Registry['profile.access_tokens.destroy']['types'],
  },
  'stations.index': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/stations',
    tokens: [{"old":"/api/v1/stations","type":0,"val":"api","end":""},{"old":"/api/v1/stations","type":0,"val":"v1","end":""},{"old":"/api/v1/stations","type":0,"val":"stations","end":""}],
    types: placeholder as Registry['stations.index']['types'],
  },
  'stations.update': {
    methods: ["PUT"],
    pattern: '/api/v1/stations/:id',
    tokens: [{"old":"/api/v1/stations/:id","type":0,"val":"api","end":""},{"old":"/api/v1/stations/:id","type":0,"val":"v1","end":""},{"old":"/api/v1/stations/:id","type":0,"val":"stations","end":""},{"old":"/api/v1/stations/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['stations.update']['types'],
  },
  'routes.index': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/routes',
    tokens: [{"old":"/api/v1/routes","type":0,"val":"api","end":""},{"old":"/api/v1/routes","type":0,"val":"v1","end":""},{"old":"/api/v1/routes","type":0,"val":"routes","end":""}],
    types: placeholder as Registry['routes.index']['types'],
  },
  'buses.index': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/buses',
    tokens: [{"old":"/api/v1/buses","type":0,"val":"api","end":""},{"old":"/api/v1/buses","type":0,"val":"v1","end":""},{"old":"/api/v1/buses","type":0,"val":"buses","end":""}],
    types: placeholder as Registry['buses.index']['types'],
  },
  'buses.update': {
    methods: ["PUT"],
    pattern: '/api/v1/buses/:id',
    tokens: [{"old":"/api/v1/buses/:id","type":0,"val":"api","end":""},{"old":"/api/v1/buses/:id","type":0,"val":"v1","end":""},{"old":"/api/v1/buses/:id","type":0,"val":"buses","end":""},{"old":"/api/v1/buses/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['buses.update']['types'],
  },
  'whatsapp.index': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/whatsapp/chats',
    tokens: [{"old":"/api/v1/whatsapp/chats","type":0,"val":"api","end":""},{"old":"/api/v1/whatsapp/chats","type":0,"val":"v1","end":""},{"old":"/api/v1/whatsapp/chats","type":0,"val":"whatsapp","end":""},{"old":"/api/v1/whatsapp/chats","type":0,"val":"chats","end":""}],
    types: placeholder as Registry['whatsapp.index']['types'],
  },
  'whatsapp.status': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/whatsapp/status',
    tokens: [{"old":"/api/v1/whatsapp/status","type":0,"val":"api","end":""},{"old":"/api/v1/whatsapp/status","type":0,"val":"v1","end":""},{"old":"/api/v1/whatsapp/status","type":0,"val":"whatsapp","end":""},{"old":"/api/v1/whatsapp/status","type":0,"val":"status","end":""}],
    types: placeholder as Registry['whatsapp.status']['types'],
  },
  'whatsapp.webhook': {
    methods: ["POST"],
    pattern: '/api/v1/whatsapp/webhook',
    tokens: [{"old":"/api/v1/whatsapp/webhook","type":0,"val":"api","end":""},{"old":"/api/v1/whatsapp/webhook","type":0,"val":"v1","end":""},{"old":"/api/v1/whatsapp/webhook","type":0,"val":"whatsapp","end":""},{"old":"/api/v1/whatsapp/webhook","type":0,"val":"webhook","end":""}],
    types: placeholder as Registry['whatsapp.webhook']['types'],
  },
  'whatsapp.simulate': {
    methods: ["POST"],
    pattern: '/api/v1/whatsapp/simulate',
    tokens: [{"old":"/api/v1/whatsapp/simulate","type":0,"val":"api","end":""},{"old":"/api/v1/whatsapp/simulate","type":0,"val":"v1","end":""},{"old":"/api/v1/whatsapp/simulate","type":0,"val":"whatsapp","end":""},{"old":"/api/v1/whatsapp/simulate","type":0,"val":"simulate","end":""}],
    types: placeholder as Registry['whatsapp.simulate']['types'],
  },
} as const satisfies Record<string, AdonisEndpoint>

export { routes }

export const registry = {
  routes,
  $tree: {} as ApiDefinition,
}

declare module '@tuyau/core/types' {
  export interface UserRegistry {
    routes: typeof routes
    $tree: ApiDefinition
  }
}
