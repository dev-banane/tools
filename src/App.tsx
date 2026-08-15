import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { AppShell } from './components/AppShell'
import { Home } from './pages/Home'
import { RandomTool } from './pages/tools/RandomTool'
import { IpTrackerTool } from './pages/tools/IpTrackerTool'
import { DnsCheckerTool } from './pages/tools/DnsCheckerTool'
import { HeadersTool } from './pages/tools/HeadersTool'
import { TtfbTool } from './pages/tools/TtfbTool'
import { SecurityHeadersTool } from './pages/tools/SecurityHeadersTool'
import { SubdomainTool } from './pages/tools/SubdomainTool'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Home />} />
          <Route path="subdomain-finder" element={<SubdomainTool />} />
          <Route path="dns-checker" element={<DnsCheckerTool />} />
          <Route path="security-headers" element={<SecurityHeadersTool />} />
          <Route path="ip-tracker" element={<IpTrackerTool />} />
          <Route path="random" element={<RandomTool />} />
          <Route path="headers" element={<HeadersTool />} />
          <Route path="ttfb" element={<TtfbTool />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
