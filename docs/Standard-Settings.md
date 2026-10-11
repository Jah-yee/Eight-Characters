# Settings: what the account keeps for a chart's day

Settings keep what [Today](Standard-Today.md) asks for with the chart on screen: a
partner's chart, where you are, and the schools the day follows. Today is about the
chart on screen, so there is no chart of your own to keep. Everything Settings show
comes from the API (`GET /api/account/settings`, `GET /api/schools`).

## Opening them

**Settings**, in the account menu, in Today's bar and among the commands, opens
`#settings`. Signed out, it asks for a sign-in first. Close goes back to the page they
were opened from. Settings are not offered in a comparison's frames. Each opening reads
the settings anew, and only the latest one draws them or says why it could not.

## Your partner's chart

A chart's bar has **Save as partner**. It asks for a name (optional: one line, at most
80 characters), says which saved partner's chart it replaces, and keeps the chart as it
is on screen: its date, time and place, its gender and its Zi-hour convention. A chart
needs a gender to be saved, since the day reads its luck pillars; without one, Save as
partner says so. A partner's chart is another person's data: save it only with their
consent.

Settings show the partner's name, birth and four pillars, each with its characters and
pinyin, or why the engine no longer charts it. **Open the chart** opens it as a chart
link, with its pass of an hour the clocks repeat where the saved birth names one;
**Remove** removes it.

## Where you are

A place search of its own, as the birth form's: choose a place from the list and save
it. The hours of a day are reckoned for it. Remove forgets it. Nothing is guessed from
the browser. A place picked while the one before is being saved stays in the search,
to be saved in turn. Saved or removed from the keyboard, the place leaves the focus in
the search.

## The schools

The three settings, as the API lists them, each a group of presets with its summary and
sources; the default is marked in words. A choice applies at once. Choosing the default
follows it again, so a later change of default applies too.

## Changes

Every change carries the account's key and the settings it was made from. Changes are
made one at a time, in the order they were made, each from the settings the one before
it left, so presets passed one after another (arrowing through a school's) are all
kept, the last deciding. A change made from settings another tab or browser has changed
since is refused, and so are the changes made after it from the same settings: the page
shows the settings as they are now, to be chosen again. A session that ended asks for a
sign-in, and the change is not repeated. Another account signed in in this browser, and
a change the API refuses, are each said on the page. Focus stays on the preset or action
that had it, or, once that is gone, on the first control of its part. A sign-out leaves
nothing of the account on the page, and until the settings are read again nothing can be
changed.

See [browser regression tests](../tests/browser/README.md): `settings.test.mjs`.
