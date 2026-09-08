# Event Modeling Viewer

The viewer is a local React/XYFlow application for exploring an Event Modeling workspace served by the `em` CLI.

## Development

From the repository root:

```bash
npm ci
npm run build --workspace apps/viewer
npm run dev --workspace apps/viewer
```

Start the CLI server separately with `em serve`; Vite proxies `/api` requests to the local CLI server on port `5198`.

The viewer consumes the CLI's public `event-modeling-spec-cli/viewer-contract` and related package subpaths. It is not published as an npm package.
