import { ApplicationService } from '@adonisjs/core/types'
import { WhatsappService } from '../app/services/whatsapp_service.js'

export default class WhatsappProvider {
  constructor(protected app: ApplicationService) {}

  async ready() {
    // Only initialize in serve mode, skip during db seed / migrations
    if (this.app.inDev || this.app.inProduction) {
      const whatsapp = WhatsappService.getInstance()
      // Initialize in the background (non-blocking)
      whatsapp.initialize()
    }
  }

  async shutdown() {
    const whatsapp = WhatsappService.getInstance()
    await whatsapp.shutdown()
  }
}
