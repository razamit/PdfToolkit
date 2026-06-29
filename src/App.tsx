import { PdfToolkitProvider } from '@/coordinator/PdfToolkitCoordinator'
import { PdfToolkitView } from '@/components/PdfToolkitView'

function App() {
  return (
    <PdfToolkitProvider>
      <PdfToolkitView />
    </PdfToolkitProvider>
  )
}

export default App
