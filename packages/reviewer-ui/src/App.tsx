import { Routes, Route, Navigate } from 'react-router';
import { ToastProvider } from './components/Toast.tsx';
import Layout from './components/Layout.tsx';
import Login from './pages/Login.tsx';
import ReviewQueue from './pages/ReviewQueue.tsx';
import ReviewDetail from './pages/ReviewDetail.tsx';
import PolicyBrowser from './pages/PolicyBrowser.tsx';
import CoverageCheck from './pages/CoverageCheck.tsx';

export default function App() {
  return (
    <ToastProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/reviews" replace />} />
          <Route path="reviews" element={<ReviewQueue />} />
          <Route path="reviews/:caseNumber" element={<ReviewDetail />} />
          <Route path="policies" element={<PolicyBrowser />} />
          <Route path="coverage-check" element={<CoverageCheck />} />
        </Route>
      </Routes>
    </ToastProvider>
  );
}
