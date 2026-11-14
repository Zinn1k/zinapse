"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

interface MarkdownMathProps {
  content: string;
  className?: string;
}

export function MarkdownMath({ content, className = "" }: MarkdownMathProps) {
  if (!content) return null;

  return (
    <div className={`prose dark:prose-invert max-w-none text-current ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
          strong: ({ children }) => <strong className="font-semibold text-indigo-600 dark:text-indigo-400">{children}</strong>,
          code: ({ children, className }) => (
            <code className={`px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono text-sm ${className || ""}`}>
              {children}
            </code>
          ),
          ul: ({ children }) => <ul className="list-disc pl-5 my-2 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-5 my-2 space-y-1">{children}</ol>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-indigo-500 pl-3 italic my-2 text-zinc-600 dark:text-zinc-400">
              {children}
            </blockquote>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
