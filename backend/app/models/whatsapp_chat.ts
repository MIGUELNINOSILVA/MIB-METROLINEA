import { WhatsappChatSchema } from '#database/schema'

export default class WhatsappChat extends WhatsappChatSchema {
  get parsedContext() {
    if (!this.context) return {}
    try {
      return JSON.parse(this.context)
    } catch {
      return {}
    }
  }

  set parsedContext(value: any) {
    this.context = JSON.stringify(value)
  }
}
