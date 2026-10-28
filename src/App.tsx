import { useEffect } from 'react';
import { Shell } from './components/layout/Shell';
import { EmptyState } from './components/ui';
import { matchRoute, useRoute } from './lib/router';
import { ComingSoon } from './pages/ComingSoon';
import { DataSources } from './pages/DataSources';
import { Flow } from './pages/Flow';
import { MetricCatalogue } from './pages/MetricCatalogue';
import { Overview } from './pages/Overview';
import { Predictability } from './pages/Predictability';
import { Quality } from './pages/Quality';
import { SquadDetail, SquadList } from './pages/Squads';

function Page({ path }: { path: string }) {
  if (path === '/') return <Overview />;
  // /predictability kept so links shared before the rename still work
  if (path === '/health' || path === '/predictability') return <Predictability />;
  if (path === '/flow') return <Flow />;
  if (path === '/quality') return <Quality />;
  // /squads kept so links shared before the squads → teams rename still work
  if (path === '/teams' || path === '/squads') return <SquadList />;
  if (path === '/metrics') return <MetricCatalogue />;
  if (path === '/data') return <DataSources />;
  const squad = matchRoute('/teams/:id', path) ?? matchRoute('/squads/:id', path);
  if (squad) return <SquadDetail id={squad.id} />;
  const coming = matchRoute('/coming/:id', path);
  if (coming) return <ComingSoon id={coming.id} />;
  return <EmptyState title="Page not found" body="Use the sidebar to navigate." />;
}

export function App() {
  const path = useRoute();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [path]);
  return (
    <Shell path={path}>
      <Page key={path} path={path} />
    </Shell>
  );
}
