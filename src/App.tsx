import type { ComponentType } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

import { AppLayout } from '@/components/layout/app-layout'
import { allNavItems } from '@/config/nav'
import { DocumentsProvider } from '@/context/documents-context'
import { AllDocumentsPage } from '@/pages/all-documents'
import { CertificatesPage } from '@/pages/certificates'
import { ComingSoonPage } from '@/pages/coming-soon'
// Classic stats-and-tables dashboard — no longer routed; see the matching commented-out
// nav entry in config/nav.ts. Kept importable rather than deleted in case we bring it back.
// import { DashboardPage } from '@/pages/dashboard'
import { HomePage } from '@/pages/home'
import { SentDocumentsPage } from '@/pages/sent-documents'
import { SettingsPage } from '@/pages/settings'
import { SignDocumentPage } from '@/pages/sign-document'
import { VerifySignaturePage } from '@/pages/verify-signature'

const pageRegistry: Partial<Record<string, ComponentType>> = {
  '/home': HomePage,
  // '/': DashboardPage,
  '/documents': AllDocumentsPage,
  '/sign': SignDocumentPage,
  '/certificates': CertificatesPage,
  '/verify': VerifySignaturePage,
  '/sent': SentDocumentsPage,
  '/settings': SettingsPage,
}

function App() {
  return (
    <DocumentsProvider>
      <Routes>
        <Route element={<AppLayout />}>
          {allNavItems.map((item) => {
            const Page = pageRegistry[item.path]
            return (
              <Route
                key={item.path}
                path={item.path}
                element={
                  Page ? (
                    <Page />
                  ) : (
                    <ComingSoonPage
                      title={item.title}
                      description={item.description}
                      icon={item.icon}
                    />
                  )
                }
              />
            )
          })}
          <Route path="/" element={<Navigate to="/home" replace />} />
          <Route path="/batch" element={<Navigate to="/sign" replace />} />
          <Route path="/signed" element={<Navigate to="/documents" replace />} />
        </Route>
      </Routes>
    </DocumentsProvider>
  )
}

export default App
