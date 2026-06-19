/* eslint-disable prettier/prettier */
import type { routes } from './index.ts'

export interface ApiDefinition {
  auth: {
    newAccount: {
      store: typeof routes['auth.new_account.store']
    }
    accessTokens: {
      store: typeof routes['auth.access_tokens.store']
    }
  }
  profile: {
    profile: {
      show: typeof routes['profile.profile.show']
    }
    accessTokens: {
      destroy: typeof routes['profile.access_tokens.destroy']
    }
  }
  stations: {
    index: typeof routes['stations.index']
    update: typeof routes['stations.update']
    analyze: typeof routes['stations.analyze']
  }
  routes: {
    index: typeof routes['routes.index']
  }
  buses: {
    index: typeof routes['buses.index']
    update: typeof routes['buses.update']
  }
  whatsapp: {
    index: typeof routes['whatsapp.index']
    show: typeof routes['whatsapp.show']
    destroy: typeof routes['whatsapp.destroy']
    status: typeof routes['whatsapp.status']
    webhook: typeof routes['whatsapp.webhook']
    simulate: typeof routes['whatsapp.simulate']
  }
}
