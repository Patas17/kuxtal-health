// frontend/src/App.tsx
import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Dashboard } from './pages/Dashboard';
import { EmergencyView } from './pages/EmergencyView';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/sos/:uuid" element={<EmergencyView />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;