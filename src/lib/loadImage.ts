/** Load an image element from a URL (object URL or data URL). */
export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('The image could not be loaded.'))
    image.src = url
  })
}
