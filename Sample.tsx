import { useCallback, useEffect, useId, useState } from 'react';
import { useResizeObserver } from '@wojtekmaj/react-hooks';
import { pdfjs, Document, Page } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

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
  }, [containerRef, hideSelectionMenu]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') hideSelectionMenu();
    };
    const onScroll = () => hideSelectionMenu();
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [hideSelectionMenu]);

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
          </div>
        )}
      </div>
    </div>
  );
}
