import { fileURLToPath } from 'node:url';
import { createApp, defaultDirs } from './app.js';

const PORT = Number(process.env.PORT ?? 3001);
const ROOT = fileURLToPath(new URL('..', import.meta.url));

const { app } = createApp(defaultDirs(ROOT));

app.listen(PORT, () => {
  console.log(`Atlas server listening on http://localhost:${PORT}`);
});
