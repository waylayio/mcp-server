export const isHTMLContent = (content) => {
    return content.includes('<!DOCTYPE html>') && content.includes('</html>');
  };
  
export const extractHTMLContent = (content) => {
    const start = content.indexOf('<!DOCTYPE html>');
    const end = content.lastIndexOf('</html>') + '</html>'.length;
    return content.slice(start, end);
  };