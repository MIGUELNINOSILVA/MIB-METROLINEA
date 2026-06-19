/* eslint-disable prettier/prettier */
/// <reference path="../manifest.d.ts" />

import type { ExtractBody, ExtractErrorResponse, ExtractQuery, ExtractQueryForGet, ExtractResponse } from '@tuyau/core/types'
import type { InferInput, SimpleError } from '@vinejs/vine/types'

export type ParamValue = string | number | bigint | boolean

export interface Registry {
  'auth.new_account.store': {
    methods: ["POST"]
    pattern: '/api/v1/auth/signup'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/user').signupValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/user').signupValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/new_account_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/new_account_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'auth.access_tokens.store': {
    methods: ["POST"]
    pattern: '/api/v1/auth/login'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/user').loginValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/user').loginValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/access_tokens_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/access_tokens_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'profile.profile.show': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/account/profile'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/profile_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/profile_controller').default['show']>>>
    }
  }
  'profile.access_tokens.destroy': {
    methods: ["POST"]
    pattern: '/api/v1/account/logout'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/access_tokens_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/access_tokens_controller').default['destroy']>>>
    }
  }
  'stations.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/stations'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/stations_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/stations_controller').default['index']>>>
    }
  }
  'stations.update': {
    methods: ["PUT"]
    pattern: '/api/v1/stations/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/stations_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/stations_controller').default['update']>>>
    }
  }
  'stations.analyze': {
    methods: ["POST"]
    pattern: '/api/v1/analyze'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/stations_controller').default['analyze']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/stations_controller').default['analyze']>>>
    }
  }
  'routes.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/routes'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/routes_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/routes_controller').default['index']>>>
    }
  }
  'buses.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/buses'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/buses_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/buses_controller').default['index']>>>
    }
  }
  'buses.update': {
    methods: ["PUT"]
    pattern: '/api/v1/buses/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/buses_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/buses_controller').default['update']>>>
    }
  }
  'whatsapp.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/whatsapp/chats'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/whatsapp_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/whatsapp_controller').default['index']>>>
    }
  }
  'whatsapp.show': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/whatsapp/chats/:phone'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { phone: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/whatsapp_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/whatsapp_controller').default['show']>>>
    }
  }
  'whatsapp.destroy': {
    methods: ["DELETE"]
    pattern: '/api/v1/whatsapp/chats/:phone'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { phone: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/whatsapp_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/whatsapp_controller').default['destroy']>>>
    }
  }
  'whatsapp.status': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/whatsapp/status'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/whatsapp_controller').default['status']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/whatsapp_controller').default['status']>>>
    }
  }
  'whatsapp.webhook': {
    methods: ["POST"]
    pattern: '/api/v1/whatsapp/webhook'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/whatsapp_controller').default['webhook']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/whatsapp_controller').default['webhook']>>>
    }
  }
  'whatsapp.simulate': {
    methods: ["POST"]
    pattern: '/api/v1/whatsapp/simulate'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/whatsapp_controller').default['simulate']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/whatsapp_controller').default['simulate']>>>
    }
  }
}
