import { Fragment, type ReactNode } from "react"
import Link from "next/link"

import { parseMarkdown, type Inline } from "@/lib/assistant/markdown"
import { cn } from "@/lib/utils"

// Rendu React du Markdown des réponses (voir src/lib/assistant/markdown.ts) : aucun HTML injecté.
// Les liens internes passent par next/link et referment la conversation pour montrer la page.

function renderInline(nodes: Inline[], onNavigate?: () => void): ReactNode[] {
  return nodes.map((node, index) => {
    switch (node.type) {
      case "text":
        return <Fragment key={index}>{node.text}</Fragment>
      case "break":
        return <br key={index} />
      case "strong":
        return <strong key={index} className="font-semibold">{renderInline(node.children, onNavigate)}</strong>
      case "em":
        return <em key={index}>{renderInline(node.children, onNavigate)}</em>
      case "code":
        return (
          <code key={index} className="rounded bg-background/70 px-1 py-0.5 font-mono text-[0.85em]">
            {node.text}
          </code>
        )
      case "link": {
        const className = "font-medium text-primary underline underline-offset-4 hover:no-underline dark:text-brand-sky"
        if (node.internal)
          return (
            <Link key={index} href={node.href} onClick={onNavigate} className={className}>
              {renderInline(node.children, onNavigate)}
            </Link>
          )
        const external = node.href.startsWith("https:")
        return (
          <a
            key={index}
            href={node.href}
            className={className}
            {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          >
            {renderInline(node.children, onNavigate)}
          </a>
        )
      }
    }
  })
}

export function AssistantMarkdown({ text, onNavigate, className }: { text: string; onNavigate?: () => void; className?: string }) {
  return (
    <div className={cn("space-y-2 leading-relaxed break-words", className)}>
      {parseMarkdown(text).map((block, index) =>
        block.type === "paragraph" ? (
          <p key={index}>{renderInline(block.children, onNavigate)}</p>
        ) : block.ordered ? (
          <ol key={index} start={block.start} className="list-decimal space-y-1 pl-5">
            {block.items.map((item, position) => (
              <li key={position}>{renderInline(item, onNavigate)}</li>
            ))}
          </ol>
        ) : (
          <ul key={index} className="list-disc space-y-1 pl-5">
            {block.items.map((item, position) => (
              <li key={position}>{renderInline(item, onNavigate)}</li>
            ))}
          </ul>
        ),
      )}
    </div>
  )
}
