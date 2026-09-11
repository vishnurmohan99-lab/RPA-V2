import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { LiveViewWindow } from './liveview/LiveViewWindow';
import './index.css';

// A live-view popup opened by Builder.tsx (window.open) carries #live=browse|run&id=&url= and
// renders only the screenshot stream full-viewport — see liveview/LiveViewWindow.tsx. Everything
// else (workflows, steps, sign-ins, ...) is the normal app. A hash fragment (not a query string)
// on purpose: it never reaches the server, so nothing there needs to know about this route, and
// no dev-server or static-host path/URL-safety rule can ever reject it.
const params = new URLSearchParams(location.hash.replace(/^#/, ''));
const live = params.get('live');
const liveId = params.get('id');

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    {(live === 'browse' || live === 'run') && liveId ? (
      <LiveViewWindow
        kind={live}
        id={liveId}
        url={params.get('url') ?? ''}
        signInId={params.get('signInId') ?? null}
        signInLabel={params.get('signInLabel') ?? null}
      />
    ) : (
      <App />
    )}
  </React.StrictMode>,
);
