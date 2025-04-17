import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const MarkdownRenderer = ({ content }) => {

  if (content.error) {
    console.warn('Expected string for MarkdownRenderer content, but got:', content);
    return (
      <div className="prose max-w-none">
      <ReactMarkdown>{content.error}</ReactMarkdown>
      </div>
    )
  }
  if (typeof content !== 'string') {
    console.warn('Expected string for MarkdownRenderer content, but got:', content);
    return (
      <div className="prose max-w-none">
      <ReactMarkdown>'Expected string for MarkdownRenderer content but got something else'</ReactMarkdown>
      </div>
    )
  }

  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]}>
      {content}
    </ReactMarkdown>
  );
};

export default MarkdownRenderer;