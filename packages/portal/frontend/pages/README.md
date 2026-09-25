# Classy's default pages

The files here are the pages Classy itself provides. They are copied into the served page
directory (`packages/portal/frontend/html/<NAME>/`) at the start of every frontend build, before
the active plugin's `portal/frontend/html/` is copied on top.

That ordering is the whole mechanism:

- a plugin that ships a file of the same name **overrides** the Classy default
- a plugin that ships nothing gets the default
- a plugin with no `portal/frontend/html/` directory at all is legitimate and builds fine

So a fork can customise any of these pages without being obliged to carry a copy of the ones it
does not want to change.

`admin.html` lives here because it is Classy's own UI. It used to be duplicated into every plugin,
which meant every change to the admin interface had to be made in four places by hand -- and the
copies drifted: the example plugin's was a term behind, still showing a Manage Pull Requests
button for code that had been removed. Course-specific pages (`student.html`, `landing.html`,
`login.html`) genuinely differ per course and stay in the plugins.

Anything added here is served to every deployment that does not override it, so treat these files
as Classy's public surface: keep the element ids stable, since the views in `src/app/views/` look
them up by id.

The build copies everything in this directory except this README (see
`packages/portal/frontend/webpack.config.js`).

Note that the frontend build refuses to run against an uncompiled tree: webpack bundles the `.js`
that `tsc` emits, so `yarn run build` from the repo root has to come first. It used to warn and exit
0 in that situation, emitting a bundle that failed at runtime.
