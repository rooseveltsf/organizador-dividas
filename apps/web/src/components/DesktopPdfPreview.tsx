import { useEffect, useRef, useState } from 'react';
import { AnnotationMode, getDocument, GlobalWorkerOptions, type PDFDocumentProxy, type PDFDocumentLoadingTask, type RenderTask } from 'pdfjs-dist';
import worker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc = worker;

export default function DesktopPdfPreview({ file }: { file: File }) {
  const [document, setDocument] = useState<PDFDocumentProxy>();
  const [pageNumber, setPageNumber] = useState(1);
  const [readyPage, setReadyPage] = useState(0);
  const [error, setError] = useState('');
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let disposed = false;
    let task: PDFDocumentLoadingTask | undefined;
    setDocument(undefined);
    setPageNumber(1);
    setReadyPage(0);
    setError('');
    void (async () => {
      try {
        const data = await file.arrayBuffer();
        if (disposed) return;
        task = getDocument({
          data,
          cMapUrl: '/pdf-resources/cmaps/',
          cMapPacked: true,
          iccUrl: '/pdf-resources/iccs/',
          standardFontDataUrl: '/pdf-resources/standard_fonts/',
          wasmUrl: '/pdf-resources/wasm/',
        });
        const pdf = await task.promise;
        if (!disposed) setDocument(pdf);
      } catch {
        if (!disposed) setError('Não foi possível exibir a prévia do PDF.');
      }
    })();
    return () => {
      disposed = true;
      void task?.destroy().catch(() => {});
    };
  }, [file]);

  useEffect(() => {
    const target = canvas.current;
    if (!document || !target) return;
    let disposed = false;
    let render: RenderTask | undefined;
    setError('');
    void (async () => {
      try {
        const page = await document.getPage(pageNumber);
        if (disposed) return;
        const size = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: 1500 / Math.max(size.width, size.height) });
        target.width = Math.ceil(viewport.width);
        target.height = Math.ceil(viewport.height);
        render = page.render({ canvas: target, viewport, annotationMode: AnnotationMode.DISABLE });
        await render.promise;
        if (!disposed) setReadyPage(pageNumber);
      } catch {
        if (!disposed) setError('Não foi possível exibir esta página.');
      }
    })();
    return () => {
      disposed = true;
      render?.cancel();
    };
  }, [document, pageNumber]);

  const visible = readyPage === pageNumber && !error;
  return (
    <div className="payslip-local-preview">
      {document && document.numPages > 1 && (
        <div className="payslip-page-controls">
          <button type="button" onClick={() => setPageNumber(pageNumber - 1)} disabled={pageNumber === 1}>Anterior</button>
          <span aria-live="polite">Página {pageNumber} de {document.numPages}</span>
          <button type="button" onClick={() => setPageNumber(pageNumber + 1)} disabled={pageNumber === document.numPages}>Próxima</button>
        </div>
      )}
      {error ? <p role="alert">{error}</p> : !visible && <p role="status">Carregando prévia…</p>}
      <canvas ref={canvas} hidden={!visible} role="img" aria-label={`Prévia do contracheque, página ${pageNumber}`} />
    </div>
  );
}
