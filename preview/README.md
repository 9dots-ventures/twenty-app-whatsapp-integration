# Front-component preview

Renders `src/front-components/whatsapp-connect.tsx` as a plain React app on
**http://localhost:4001**, with no Twenty server and no Docker.

```bash
cd twenty-app-new
yarn install
yarn preview
```

This is a **UI harness only**. It does not validate the app manifest, logic
functions, permissions, or the front-component sandbox — verify those with
`yarn twenty dev` against a real instance before deploying.

## How it works

Three Twenty imports are aliased to local stubs in `preview/stubs/`:

| Import | Stub | Behaviour |
|---|---|---|
| `twenty-sdk/define` | `define.ts` | Returns the definition object unchanged |
| `twenty-sdk/front-component` | `front-component.tsx` | `enqueueSnackbar` renders a real toast |
| `twenty-client-sdk/rest` | `rest.ts` | Fakes `GET /s/whatsapp/config`; patches `window.open` |

Everything else — component source, `src/constants/*`, styles, the canvas
animation — is the real code. Edits hot-reload.

## Query params

| Param | Default | Effect |
|---|---|---|
| `state` | `ok` | `loading` = config never resolves (spinner); `error` = config rejects (error card) |
| `connections` | `0` | Starting connection count — set ≥1 to see the badge and "Connect another account" |
| `delay` | `400` | ms before the config response resolves |
| `autoconnect` | `6` | Seconds after Connect before a connection appears. `0` = never, so the poll runs to its 5-minute timeout |
| `popup` | *(stub)* | `real` opens the actual Render signup page; `blocked` returns `null` to test the popup-blocked banner |
| `frame` | `full` | `panel` renders at ~420 px side-panel width |

### Common checks

```
http://localhost:4001/                          first-run empty state
http://localhost:4001/?connections=2            returning user, badge visible
http://localhost:4001/?state=loading            spinner
http://localhost:4001/?state=error              config failure card
http://localhost:4001/?autoconnect=3            happy path: connect → success + toast
http://localhost:4001/?popup=blocked            popup-blocked error banner
http://localhost:4001/?frame=panel              side-panel width
```

## Adding another front component

Change the import in `main.tsx`. If it uses Twenty APIs beyond the three above,
add an alias in `preview/vite.config.ts` and a stub alongside the existing ones.
