/** Guarda un archivo que llegó de la API (por ejemplo, la descarga del registro). */
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
  // El navegador ya tomó el archivo: se libera la memoria
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
