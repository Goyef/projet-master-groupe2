import { assistantEnabled } from "@/lib/assistant/config"
import { getTexts } from "@/lib/i18n-server"

import { AssistantWidget } from "./assistant-widget"

// Assistant du site : rien n'est affiché tant que OPENAI_API_KEY n'est pas définie côté serveur.
export async function Assistant() {
  if (!assistantEnabled()) return null
  const dict = await getTexts()
  return (
    <AssistantWidget
      dict={dict.assistant}
      crisis={dict.crisis}
      types={dict.types}
      closeLabel={dict.common.close}
      errors={{ network: dict.errors.network, failed: dict.errors.assistantFailed }}
    />
  )
}
