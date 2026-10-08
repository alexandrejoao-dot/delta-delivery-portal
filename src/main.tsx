import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { DataProvider } from './data/DataContext';
import { FiltersProvider } from './state/filters';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DataProvider>
      <FiltersProvider>
        <App />
      </FiltersProvider>
    </DataProvider>
  </StrictMode>,
);
