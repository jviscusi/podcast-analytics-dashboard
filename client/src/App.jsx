import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout/Layout';
import Dashboard from './pages/Dashboard';
import Episodes from './pages/Episodes';
import EpisodeDetail from './pages/EpisodeDetail';
import Platforms from './pages/Platforms';
import Insights from './pages/Insights';
import MediaKit from './pages/MediaKit';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="episodes" element={<Episodes />} />
          <Route path="episodes/:id" element={<EpisodeDetail />} />
          <Route path="platforms" element={<Platforms />} />
          <Route path="insights" element={<Insights />} />
          <Route path="media-kit" element={<MediaKit />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
