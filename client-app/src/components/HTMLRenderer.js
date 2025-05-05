import { isHTMLContent, extractHTMLContent } from '../utils/htmlDetector';

const HTMLRenderer = ({ content }) => {
  if (!isHTMLContent(content)) return null;

  const htmlContent = extractHTMLContent(content);
  const blob = new Blob([htmlContent], { type: 'text/html' });
  const url = URL.createObjectURL(blob);

  return (
    <div className="html-renderer-container">
      <iframe 
        src={url}
        title="HTML Content"
        sandbox="allow-scripts allow-same-origin"
        className="w-full h-96 border border-gray-300 rounded-lg"
      />
    </div>
  );
};

export default HTMLRenderer;