import { createRoot } from 'react-dom/client';

// Stubs must be imported before the component so window.open is patched first.
import './stubs/rest';

import whatsappConnect from 'src/front-components/whatsapp-connect';

const params = new URLSearchParams(window.location.search);
const stage = document.getElementById('stage');

if (!stage) throw new Error('#stage missing');

// ?frame=panel renders at Twenty side-panel width; default is full canvas.
stage.dataset.frame = params.get('frame') ?? 'full';

const Component = whatsappConnect.component;

createRoot(stage).render(<Component />);
