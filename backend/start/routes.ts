/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import { middleware } from '#start/kernel'
import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'

router.get('/', () => {
  return { hello: 'world' }
})

router
  .group(() => {
    router
      .group(() => {
        router.post('signup', [controllers.NewAccount, 'store'])
        router.post('login', [controllers.AccessTokens, 'store'])
      })
      .prefix('auth')
      .as('auth')

    router
      .group(() => {
        router.get('profile', [controllers.Profile, 'show'])
        router.post('logout', [controllers.AccessTokens, 'destroy'])
      })
      .prefix('account')
      .as('profile')
      .use(middleware.auth())

    // SITME - Metrolínea Endpoints
    router.get('stations', [controllers.Stations, 'index'])
    router.put('stations/:id', [controllers.Stations, 'update'])
    router.get('routes', [controllers.Routes, 'index'])
    router.get('buses', [controllers.Buses, 'index'])
    router.put('buses/:id', [controllers.Buses, 'update'])
    router.get('whatsapp/chats', [controllers.Whatsapp, 'index'])
    router.get('whatsapp/chats/:phone', [controllers.Whatsapp, 'show'])
    router.get('whatsapp/status', [controllers.Whatsapp, 'status'])
    router.post('whatsapp/webhook', [controllers.Whatsapp, 'webhook'])
    router.post('whatsapp/simulate', [controllers.Whatsapp, 'simulate'])
  })
  .prefix('/api/v1')
