import { splitInlineCode } from './inline-code';

/** Quiz text with `inline code` shown as code (see splitInlineCode). */
export function InlineText({ text }: { text: string }) {
  return splitInlineCode(text).map((part, index) =>
    part.code ? (
      <code key={index} className="inline-code">
        {part.text}
      </code>
    ) : (
      <span key={index}>{part.text}</span>
    ),
  );
}
