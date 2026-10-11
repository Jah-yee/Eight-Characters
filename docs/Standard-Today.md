# The chart's day: Today in Standard mode

Today shows what a day, its month, its year and the luck pillar in force bring to the
chart on screen, and to its partner's when it is in a couple. The API reckons all of it (`POST /api/today`, by
[Today: the rules](Today.md)); the page draws its answer and computes nothing. The one
thing the page reads itself is the date on the clock at where you are.

## Opening it

**Chart · Today**, in a chart's bar, opens the chart's day: today's date where you are.
The chart needs a gender, since the day reads its luck pillars. Today is not offered in
a comparison's frames, and the Evolution explorer, a page of its own, has none.

The day asks for what the account keeps in [Settings](Standard-Settings.md): where you
are, the schools and, when the chart on screen is a saved chart in a couple, the other
chart of the couple. Without a place, Today says so and leads to
Settings; without a gender, back to the chart.

## The page

- **The bar:** the date, the chart and where you are; Chart · Today; the day before,
  Today (where you are) and the day after; whose day, when the chart is in a couple;
  FI · EN; Copy link; Copy as text; Print; Settings. Below 640px the actions show as
  their icons.
- **The pull line:** the day's band and score.
- **The topics:** the day's page, Marriage (in a couple), Work and Health,
  each in the panel.
- **The run:** 22 days, 7 back and 14 ahead, each with its pillar, its pinyin, its score
  and its band as a mark. A band's mark says it by shape: a filled circle, a ring, a dash,
  a box and a filled box, from strongly supportive to strongly draining. Choosing a day
  shows it.
- **The day's four pillars:** the day, the month, the year and the luck pillar, each
  with its characters and pinyin, the Ten God of its stem, and its pull. The luck pillar
  gives its decade and phase, or says there is none on the day.
- **In your chart:** the relationships the four form with the chart, each with the
  canon's line in English.
- **The hours:** the twelve double hours on the clock at where you are, the Zi hour with
  its two spans, each hour's ties to the day and its call: Protect, Mixed or Avoid, by
  word and by mark. An hour with no tie has no call.

The day's page gives, for each of the four pillars, the parts of its pull (each
character, its element, its weight, how much it counts and its value) and the canon's
readings, as the decade page reads a luck pillar. A pillar's own page, opened from its
card, gives the same for that pillar alone. Health says it reads the day's elements,
not the body: it is not health advice.

## A partner's day

When the chart on screen is a saved chart in a couple, the bar names its partner beside
This chart. The partner's day turns the whole page to the partner's chart, counted at
where you are, and the page says so; opening the partner's chart itself reads the same
couple from its side. Marriage reads both: each pull, whether the day pulls you apart,
the day at the spouse palace, and the day's relationships with the other chart. A chart
that is not saved, or not in a couple, has no partner side. If the couple ends
elsewhere, or the partner's chart no longer charts, the partner's day says so and
offers the chart's own.

## Its address

`#today?` with the chart's own link parts, as `#chart?` has them (see
[Chart links](Standard-Links.md)), then:
- `day`, the day shown, `YYYY-MM-DD`;
- `who=partner` for the partner's day;
- `topic`: `day`, `marriage`, `work`, `health`, or `pillar/day`, `pillar/month`,
  `pillar/year`, `pillar/luck`.

A link names the chart and the day. The couple and where you are come from the
account that opens it, and a link opened signed out asks for a sign-in first. A link
with an unknown, repeated or invalid part says so, naming the part, as a chart link
does. A day the API cannot read (outside the engine's years, with the run's days) is
shown with the API's reason, and nothing of the day before, nor its open topic, stays on
screen; Try again asks again. While a day is on its way, the day before and its topic
are dimmed.

A day step, Today, the partner switch and the language replace the address; a topic,
and Chart · Today, add to the history. Only the answer to the latest request is drawn.
The chart, from Today's bar or its commands, opens in the language the day is shown in.
A link opened signed out asks for a sign-in, and the day is then shown in the account's
language, which its address then names; a session that ends while the day is open asks
for a sign-in when the day is next asked for. A sign-out leaves nothing of the account's
day on the page: neither where you are nor a partner's name. Marriage, open when the couple ends
elsewhere (or the partner's chart no longer charts), closes, and the page says why.

## Keys and commands

While the page has focus and no field does: `[` and `]` the day before and after, N
today where you are, Escape closes a topic, ? lists the day's keys. A topic, a day of the
run or an action chosen from the keyboard keeps the focus on its button once the day is
drawn again; Today, which is then unavailable, hands it to the day's heading. Chart ·
Today hands the focus across: to Today on the day's bar, or to Chart on the chart's, so
each page's keys act at once. Brackets are typed with
Alt or AltGr on many keyboards; a held key steps once. The commands (⌘K or Ctrl+K) hold
the steps, the partner's day, the topics, the chart, Copy link, Copy as text and Print
(once the day is drawn) and Settings.

## In Finnish

The canon's readings are in English only: a Finnish day has none, and the day's page
shows the pulls' parts. The owner confirmed the Finnish names on 2026-10-11. Numbers
are written the Finnish way.

## Copy and print

Copy as text gives the date, the chart and where you are, the schools, the day's pull
line, the four pillars with their pulls, the run as dates and pulls, and the hours with
their calls. Printing gives the page without its controls; the run prints every day,
each with its band as a word. Until a day's own answer is drawn, Copy as text and Print
say they are unavailable, so neither gives one day's numbers under another's date.

See [browser regression tests](../tests/browser/README.md): `today.test.mjs`.
