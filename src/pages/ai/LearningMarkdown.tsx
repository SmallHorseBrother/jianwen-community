import React from 'react';

const LearningMarkdown: React.FC<{ value: string }> = ({ value }) => {
  const blocks = value.split(/\n\s*\n/).map((block) => block.trim()).filter(Boolean);
  return (
    <div className="ai-learning-markdown">
      {blocks.map((block, index) => {
        if (block.startsWith('## ')) return <h2 key={index}>{block.slice(3)}</h2>;
        if (block.startsWith('### ')) return <h3 key={index}>{block.slice(4)}</h3>;
        const lines = block.split('\n');
        if (lines.every((line) => line.startsWith('- '))) {
          return <ul key={index}>{lines.map((line) => <li key={line}>{line.slice(2)}</li>)}</ul>;
        }
        if (lines.every((line) => /^\d+\. /.test(line))) {
          return <ol key={index}>{lines.map((line) => <li key={line}>{line.replace(/^\d+\. /, '')}</li>)}</ol>;
        }
        return <p key={index}>{block}</p>;
      })}
    </div>
  );
};

export default LearningMarkdown;
