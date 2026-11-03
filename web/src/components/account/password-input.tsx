"use client"

import { useState } from "react"
import { EyeIcon, EyeOffIcon } from "lucide-react"

import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group"

type PasswordInputProps = Omit<React.ComponentProps<"input">, "type"> & {
  labels: { show: string; hide: string }
}

// Champ mot de passe avec un bouton « œil » pour afficher ou masquer la saisie et la vérifier.
export function PasswordInput({ labels, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false)

  return (
    <InputGroup>
      <InputGroupInput {...props} type={visible ? "text" : "password"} />
      <InputGroupAddon align="inline-end">
        <InputGroupButton
          size="icon-xs"
          aria-label={visible ? labels.hide : labels.show}
          aria-controls={props.id}
          aria-pressed={visible}
          title={visible ? labels.hide : labels.show}
          onClick={() => setVisible((value) => !value)}
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  )
}
