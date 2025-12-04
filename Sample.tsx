import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useResizeObserver } from '@wojtekmaj/react-hooks';
import { pdfjs, Document, Page } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

import 'katex/dist/katex.min.css'; // 引入 KaTeX 样式

import './Sample.css';

import type { PDFDocumentProxy } from 'pdfjs-dist';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

const options = {
  cMapUrl: '/cmaps/',
  standardFontDataUrl: '/standard_fonts/',
  wasmUrl: '/wasm/',
};

const resizeObserverOptions = {};

const maxWidth = 800;

type PDFFile = string | File | null;

export default function Sample() {
  const fileId = useId();
  const [file, setFile] = useState<PDFFile>('./sample.pdf');
  const [numPages, setNumPages] = useState<number>();
  const [containerRef, setContainerRef] = useState<HTMLElement | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>();
  const [selectionText, setSelectionText] = useState<string>('');
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [askOpen, setAskOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 拖动相关的状态
  const [dragging, setDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);
  const [dialogPosition, setDialogPosition] = useState<{ x: number; y: number } | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const onResize = useCallback<ResizeObserverCallback>((entries) => {
    const [entry] = entries;

    if (entry) {
      setContainerWidth(entry.contentRect.width);
    }
  }, []);

  useResizeObserver(containerRef, resizeObserverOptions, onResize);

  function onFileChange(event: React.ChangeEvent<HTMLInputElement>): void {
    const { files } = event.target;

    const nextFile = files?.[0];

    if (nextFile) {
      setFile(nextFile);
    }
  }

  function onDocumentLoadSuccess({ numPages: nextNumPages }: PDFDocumentProxy): void {
    setNumPages(nextNumPages);
  }

  const hideSelectionMenu = useCallback(() => {
    setSelectionText('');
    setMenuPosition(null);
    setDialogPosition(null);
  }, []);

  const onMouseUp = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) {
      hideSelectionMenu();
      return;
    }
    const text = sel.toString().trim();
    if (!text) {
      hideSelectionMenu();
      return;
    }
    const range = sel.rangeCount ? sel.getRangeAt(0) : null;
    if (!range) {
      hideSelectionMenu();
      return;
    }
    const anchor = sel.anchorNode as Node | null;
    if (containerRef && anchor && !containerRef.contains(anchor)) {
      hideSelectionMenu();
      return;
    }
    const rect = range.getBoundingClientRect();
    setSelectionText(text);
    setMenuPosition({ x: rect.left + rect.width / 2, y: rect.bottom + 8 });
    setAskOpen(false);
    setAnswer(null);
    setError('');
    setDialogPosition(null); // 重置对话框位置
  }, [containerRef, hideSelectionMenu]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') hideSelectionMenu();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [hideSelectionMenu]);

  // 处理拖动开始
  const handleDragStart = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!dialogRef.current) return;

    const rect = dialogRef.current.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
    setDragging(true);
  };

  // 处理拖动过程
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (dragging && dragOffset) {
        setDialogPosition({
          x: e.clientX - dragOffset.x,
          y: e.clientY - dragOffset.y
        });
      }
    };

    const handleMouseUp = () => {
      setDragging(false);
      setDragOffset(null);
    };

    if (dragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging, dragOffset]);

  async function copySelection(): Promise<void> {
    try {
      await navigator.clipboard.writeText(selectionText);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = selectionText;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    hideSelectionMenu();
  }

  function clearSelection(): void {
    window.getSelection()?.removeAllRanges();
    hideSelectionMenu();
  }

  async function submitAsk(): Promise<void> {
    if (!selectionText) {
      setError('请先选择文本');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: selectionText, question }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || '提问失败');
      } else {
        setAnswer(data.answer || '');
      }
    } catch {
      setError('网络错误');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="Example">
      <header>
        <h1>react-pdf sample page</h1>
      </header>
      <div className="Example__container">
        <div className="Example__container__load">
          <label htmlFor={fileId}>Load from file:</label>{' '}
          <input id={fileId} onChange={onFileChange} type="file" />
        </div>
        <div className="Example__container__document" ref={setContainerRef} onMouseUp={onMouseUp}>
          <Document file={file} onLoadSuccess={onDocumentLoadSuccess} options={options}>
            {Array.from(new Array(numPages), (_el, index) => (
              <Page
                key={`page_${index + 1}`}
                pageNumber={index + 1}
                width={containerWidth ? Math.min(containerWidth, maxWidth) : maxWidth}
              />
            ))}
          </Document>
        </div>
        {menuPosition && selectionText && (
          <div
            className="SelectionMenu"
            style={{ position: 'fixed', left: menuPosition.x, top: menuPosition.y }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button onClick={copySelection}>复制</button>
            <button onClick={clearSelection}>清除</button>
            <button onClick={() => setAskOpen(true)}>提问</button>
          </div>
        )}
        {askOpen && menuPosition && (
          <div
            ref={dialogRef}
            className="AskDialog"
            style={{
              position: 'fixed',
              left: dialogPosition ? dialogPosition.x : menuPosition.x,
              top: dialogPosition ? dialogPosition.y : menuPosition.y + 40,
              cursor: dragging ? 'grabbing' : 'grab'
            }}
            onMouseDown={(e) => {
              e.stopPropagation();
              // 如果点击的不是标题或按钮，则开始拖动
              if (e.target instanceof HTMLElement) {
                if (!e.target.closest('.AskDialog__title') &&
                    !e.target.closest('button') &&
                    !e.target.closest('textarea') &&
                    !e.target.closest('.AskDialog__answer')) {
                  handleDragStart(e);
                }
              }
            }}
          >
            <div className="AskDialog__title" style={{ cursor: 'grab' }}>
              智能提问
            </div>
            <div className="AskDialog__context">{selectionText}</div>
            <textarea
              className="AskDialog__question"
              placeholder="你的问题（可留空，直接让模型总结选中文本）"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
            />
            <div className="AskDialog__actions">
              <button disabled={loading} onClick={submitAsk}>{loading ? '提问中…' : '提交'}</button>
              <button onClick={() => setAskOpen(false)}>关闭</button>
            </div>
            {error && <div className="AskDialog__error">{error}</div>}
            {answer && (
              <div className="AskDialog__answer">
                <ReactMarkdown
                  remarkPlugins={[remarkMath]}
                  rehypePlugins={[rehypeKatex]}
                  components={{
                    // 为代码块添加适当的样式
                    code: ({node, inline, className, children, ...props}) => {
                      const match = /language-(\w+)/.exec(className || '');
                      return !inline && match ? (
                        <pre className={className}>
                          <code {...props}>{children}</code>
                        </pre>
                      ) : (
                        <code className={className} {...props}>{children}</code>
                      );
                    }
                  }}
                >
                  {answer}
                </ReactMarkdown>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
