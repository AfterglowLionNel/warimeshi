import type { ReactNode } from "react"

export type FaqItem = {
  question: string
  answer: string
  answerNode?: ReactNode
}

interface FaqSectionProps {
  heading?: string
  description?: string
  items: FaqItem[]
  jsonLdId?: string
  className?: string
}

export function FaqSection({
  heading = "よくある質問",
  description,
  items,
  jsonLdId,
  className = "",
}: FaqSectionProps) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  }

  return (
    <section className={`container mx-auto px-5 pb-12 ${className}`} aria-labelledby={jsonLdId ?? "faq-heading"}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="max-w-md mx-auto md:max-w-2xl">
        <h2
          id={jsonLdId ?? "faq-heading"}
          className="mb-3 text-[13px] font-bold tracking-[.12em] text-[var(--wm-ink-3)]"
        >
          {heading}
        </h2>
        {description && (
          <p className="mb-3 text-[12px] leading-relaxed text-[var(--wm-ink-3)]">
            {description}
          </p>
        )}
        <div className="space-y-1.5">
          {items.map((item) => (
            <details
              key={item.question}
              className="group rounded-[12px] border border-[var(--wm-line)] bg-card transition-colors [&[open]]:bg-[var(--wm-surface)]/30"
            >
              <summary className="flex cursor-pointer list-none items-start justify-between gap-3 px-4 py-3 text-left text-[13.5px] font-medium text-foreground transition-colors hover:bg-[var(--wm-surface)]/40 [&::-webkit-details-marker]:hidden">
                <span className="flex-1">{item.question}</span>
                <span
                  aria-hidden="true"
                  className="mt-1 inline-block h-2 w-2 shrink-0 border-r-2 border-b-2 border-[var(--wm-ink-3)] transition-transform group-open:rotate-45 -rotate-45"
                />
              </summary>
              <div className="px-4 pb-4 pt-0 text-[13px] leading-[1.75] text-[var(--wm-ink-2)]">
                {item.answerNode ?? item.answer}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
