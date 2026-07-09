"use client";

// Markdown — shared renderer for AI coach replies (full /coach page + the
// floating CoachDock). Wraps react-markdown + remark-gfm and styles output
// via the global .chat-md class. Raw HTML in model output stays escaped
// (react-markdown default — no rehype-raw), so replies can never inject
// markup. Links open in a new tab; tables get their own horizontal scroller
// so wide content never breaks the chat layout.

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ComponentProps } from "react";

function MdLink(props: ComponentProps<"a">) {
  return (
    <a {...props} target="_blank" rel="noopener noreferrer">
      {props.children}
    </a>
  );
}

function MdTable(props: ComponentProps<"table">) {
  return (
    <div className="chat-md-tablewrap">
      <table {...props} />
    </div>
  );
}

export function Markdown({ content }: { content: string }) {
  return (
    <div className="chat-md">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: MdLink, table: MdTable }}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
