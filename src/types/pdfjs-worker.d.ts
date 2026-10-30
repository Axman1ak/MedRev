// Le worker de pdfjs n'a pas de déclarations de types. On ne s'en sert que
// pour le poser sur globalThis.pdfjsWorker (voir src/lib/pdfRegion.ts).
declare module 'pdfjs-dist/legacy/build/pdf.worker.mjs'
