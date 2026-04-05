import html2canvas from 'html2canvas'

export async function downloadAsPng(element: HTMLElement, filename: string): Promise<void> {
  const canvas = await html2canvas(element, {
    backgroundColor: '#0A0A0A',
    scale: 2,           // 2x for crisp output
    useCORS: true,      // needed for DO Spaces images (worker photo)
    logging: false,
  })

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(b => b ? resolve(b) : reject(new Error('Canvas to blob failed')), 'image/png')
  })

  const url = URL.createObjectURL(blob)
  const a   = document.createElement('a')
  a.href     = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
