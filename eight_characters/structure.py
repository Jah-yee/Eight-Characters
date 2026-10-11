"""Structure (格局 Ge Ju), after Zi Ping Zhen Quan (子平真诠, Shen Xiaozhan 沈孝瞻):
the chart's structure, named from its month (docs/Today.md).

论用神: 八字用神，专求月令，以日干配月令地支，而生克不同，格局分焉 (a chart's useful god
is sought in the month alone: set the Day Master against the month's branch, and by
how they generate and control, the structures divide). The rules below name every
example chart the text gives in its structure chapters as the text names it
(tests/test_structure.py), leaving out those it calls a change upon a change
(变之又变) and three that every copy garbles.
"""

from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass
from typing import Final, Literal

from typing_extensions import TypedDict

from eight_characters.data import ElementName
from eight_characters.mappings import hidden_stems_lookup, ten_gods_lookup
from eight_characters.schools import (
    PILLAR_NAMES,
    QI_NAMES,
    QI_TENTHS,
    STANDING_TENTHS,
    STEM_TENTHS,
    Standing,
    controller_of,
    controls,
    element_of,
    generates,
    generator_of,
)
from eight_characters.ten_gods import TenGodName

StructureName = Literal[
    'direct_officer',
    'seven_killings',
    'wealth',
    'resource',
    'eating_god',
    'hurting_officer',
    'yang_blade',
    'jian_lu_yue_jie',
]
STRUCTURES: Final[tuple[StructureName, ...]] = (
    'direct_officer',
    'seven_killings',
    'wealth',
    'resource',
    'eating_god',
    'hurting_officer',
    'yang_blade',
    'jian_lu_yue_jie',
)
# Each Ten God's structure. Wealth and Resource are one structure whichever their
# polarity (论印绶: 正偏同为美格，故财与印不分偏正，同为一格而论之); a month whose
# god is the Day Master's own element is Jian Lu Yue Jie (建禄月劫).
STRUCTURE_OF_GOD: Final[dict[TenGodName, StructureName]] = {
    'friend': 'jian_lu_yue_jie',
    'rob_wealth': 'jian_lu_yue_jie',
    'eating_god': 'eating_god',
    'hurting_officer': 'hurting_officer',
    'indirect_wealth': 'wealth',
    'direct_wealth': 'wealth',
    'seven_killings': 'seven_killings',
    'direct_officer': 'direct_officer',
    'indirect_resource': 'resource',
    'direct_resource': 'resource',
}
_OWN: Final[frozenset[TenGodName]] = frozenset({'friend', 'rob_wealth'})
# Each Day Master's prosperity (禄 Lu), the branch it is rooted in at its height.
PROSPERITY: Final[dict[str, str]] = dict(
    zip('甲乙丙丁戊己庚辛壬癸', '寅卯巳午巳午申酉亥子', strict=True)
)
# 论阳刃: 禄前一位，惟五阳有之 (the branch after the prosperity, for yang Day Masters only).
BLADE: Final[dict[str, str]] = {
    '甲': '卯',
    '丙': '午',
    '戊': '午',
    '庚': '酉',
    '壬': '子',
}
# The four graves (四墓), whose months are mixed (杂气 Za Qi).
GRAVES: Final = '辰戌丑未'
# The three-way combinations (三合), each with its middle branch, whose main qi is the
# combination's element.
COMBINATIONS: Final[tuple[str, ...]] = ('申子辰', '亥卯未', '寅午戌', '巳酉丑')
STEM_ORDER: Final = '甲乙丙丁戊己庚辛壬癸'

Gods = tuple[TenGodName, ...]
FRIEND: Final[Gods] = ('friend',)
ROB: Final[Gods] = ('rob_wealth',)
COMPANIONS: Final[Gods] = ('friend', 'rob_wealth')
EATING: Final[Gods] = ('eating_god',)
HURTING: Final[Gods] = ('hurting_officer',)
OUTPUT: Final[Gods] = ('eating_god', 'hurting_officer')
WEALTH: Final[Gods] = ('indirect_wealth', 'direct_wealth')
KILLINGS: Final[Gods] = ('seven_killings',)
OFFICER: Final[Gods] = ('direct_officer',)
OFFICERS: Final[Gods] = ('seven_killings', 'direct_officer')
OWL: Final[Gods] = ('indirect_resource',)
RESOURCE: Final[Gods] = ('indirect_resource', 'direct_resource')
# The Day Master's support, as Support and restrain counts it.
SUPPORT: Final[Gods] = COMPANIONS + RESOURCE

# The five stem combinations (五合), each with the element it turns into.
COMBINING: Final[dict[frozenset[str], ElementName]] = {
    frozenset('甲己'): 'earth',
    frozenset('乙庚'): 'metal',
    frozenset('丙辛'): 'water',
    frozenset('丁壬'): 'wood',
    frozenset('戊癸'): 'fire',
}
# The directional combinations (三会), each with its element.
DIRECTIONS: Final[dict[str, ElementName]] = {
    '寅卯辰': 'wood',
    '巳午未': 'fire',
    '申酉戌': 'metal',
    '亥子丑': 'water',
}


NamedBy = Literal[
    # The month is the Day Master's prosperity or, for a yang Day Master, its blade.
    'prosperity',
    'blade',
    # Another month: its main qi shows; its middle qi shows (用神变化), or would but a
    # showing stem keeps the main qi; a mixed month's stem shows; the month joins a
    # three-way combination; nothing of it shows.
    'main_qi_shows',
    'middle_qi_shows',
    'main_qi_kept',
    'mixed_shows',
    'combination',
    'main_qi',
]


class Naming(TypedDict):
    structure: StructureName
    by: NamedBy
    # The stem whose god names the structure: the month's hidden stem, the showing stem
    # of a mixed month, or the combination's middle branch's main qi. None for the
    # prosperity and the blade.
    stem: str | None
    # The stem that keeps the month's main qi (main_qi_kept), or the combination
    # (combination); otherwise None.
    because: str | None


def ten_god(day_master: str, stem: str) -> TenGodName:
    return ten_gods_lookup()[(day_master, stem)]


def _shown(pillars: Mapping[str, tuple[str, str]]) -> list[str]:
    """The stems a chart shows besides its Day Master, year first."""
    return [pillars[name][0] for name in PILLAR_NAMES if name != 'day']


def _branches(pillars: Mapping[str, tuple[str, str]]) -> list[str]:
    return [pillars[name][1] for name in PILLAR_NAMES]


def full_combination(branch: str, branches: Sequence[str]) -> str | None:
    """The three-way combination this branch completes with the chart's branches."""
    return next(
        (
            combination
            for combination in COMBINATIONS
            if branch in combination
            and all(member in branches for member in combination)
        ),
        None,
    )


def _bound(shown: Sequence[str]) -> set[int]:
    """Indexes of shown stems combined (五合) with the stem beside them, year–month or
    month–hour: such a stem is taken away (戊癸作合，财印两失; 壬财丁印，二者相合)."""
    bound: set[int] = set()
    for index in range(len(shown) - 1):
        if frozenset((shown[index], shown[index + 1])) in COMBINING:
            bound |= {index, index + 1}
    return bound


def _keeper(shown: Sequence[str], main: str, new: str) -> str | None:
    """A shown stem that generates the main qi's element and controls the new god's,
    which keeps the month's own god (变之而不失本格)."""
    return next(
        (
            seen
            for seen in shown
            if generates(element_of(seen)) == element_of(main)
            and controls(element_of(seen)) == element_of(new)
        ),
        None,
    )


def name_structure(pillars: Mapping[str, tuple[str, str]]) -> Naming:
    """The chart's structure, after Zi Ping Zhen Quan (docs/Today.md, Structure).

    1. The month at the Day Master's prosperity is Jian Lu Yue Jie (论建禄月劫: 建禄者，
       月建逢禄堂也……建禄与月劫，可同一格), and a yang Day Master's blade, the branch
       after it, is Yang Blade (论阳刃: 禄前一位，惟五阳有之). A full three-way
       combination with a blade month whose element shows in a stem turns it into
       that element's god, unless it is the Day Master's own (若戊生午月，干透丙火，
       支会火局，则化刃为印). The prosperity stays: its combination gives it a use
       (皆以透干会支，别取财官煞食为用), as 金水相涵 (庚生申月……子辰会局) is listed
       with 禄劫用伤食.
    2. A mixed month (辰戌丑未) is named by what shows of it: 透干会取其清者用之. A
       hidden stem shows when a stem of its element does (甲透未库), and the shown
       stem's own god names the structure (辰中暗煞，壬以透之); two shown stems that
       combine side by side are taken away (戊癸作合，财印两失). Of what is left, an
       Officer or Killings shown by the month's own stem comes first (甲生丑月，辛透为官
       ……而又透己财以生官), else the first in the month's hidden-stem order; an Eating
       God so chosen gives way to Killings that show (煞逢食制，则煞为用，食为相). With
       nothing showing, a full three-way combination the month joins names it, else
       its main qi. A god of the Day Master's own element names Jian Lu Yue Jie (透乙
       则用月劫).
    3. Another month is named by its main qi when it shows (辛生寅月……而又透甲，格成
       正财). Else by its middle qi, when that shows and is not the Day Master's own
       element (不透甲而透丙……同知得以作主; 禄堂透出……非也), unless a shown stem
       generates the main qi's element and controls the middle qi's (乙生申月，透壬化印，
       而又透戊，则财能生官，印逢财而退位). Else by a full three-way combination (丁生亥
       月，本为正官，支全卯未，则化为印); one into the Day Master's own element names
       Jian Lu Yue Jie, unless a shown stem keeps the main qi as above (丙生寅月，午戌
       会劫，而又或透甲，或透壬，则仍为印). Else by the main qi.
    """
    day_master = pillars['day'][0]
    month = pillars['month'][1]
    shown = _shown(pillars)
    branches = _branches(pillars)
    hidden = hidden_stems_lookup()[month]
    main = hidden[0]
    own_month: NamedBy | None = (
        'prosperity'
        if PROSPERITY[day_master] == month
        else 'blade'
        if BLADE.get(day_master) == month
        else None
    )
    if own_month is not None:
        combination = full_combination(month, branches)
        if own_month == 'blade' and combination is not None:
            stem = hidden_stems_lookup()[combination[1]][0]
            god = ten_god(day_master, stem)
            if god not in _OWN and any(
                element_of(seen) == element_of(stem) for seen in shown
            ):
                return {
                    'structure': STRUCTURE_OF_GOD[god],
                    'by': 'combination',
                    'stem': stem,
                    'because': combination,
                }
        return {
            'structure': 'jian_lu_yue_jie'
            if own_month == 'prosperity'
            else 'yang_blade',
            'by': own_month,
            'stem': None,
            'because': None,
        }
    if month in GRAVES:
        bound = _bound(shown)
        free = [seen for index, seen in enumerate(shown) if index not in bound]
        # Each hidden stem, in order, with the free stems that show it.
        candidates: list[tuple[str, str]] = []
        for stem in hidden:
            candidates += [
                (seen, stem)
                for seen in free
                if element_of(seen) == element_of(stem)
                and seen not in [chosen for chosen, _ in candidates]
            ]
        if candidates:
            exact_officer = next(
                (
                    seen
                    for seen, stem in candidates
                    if seen == stem and ten_god(day_master, seen) in OFFICERS
                ),
                None,
            )
            first = exact_officer if exact_officer is not None else candidates[0][0]
            if ten_god(day_master, first) == 'eating_god':
                first = next(
                    (
                        seen
                        for seen, _ in candidates
                        if ten_god(day_master, seen) == 'seven_killings'
                    ),
                    first,
                )
            return {
                'structure': STRUCTURE_OF_GOD[ten_god(day_master, first)],
                'by': 'mixed_shows',
                'stem': first,
                'because': None,
            }
        return _by_combination(day_master, month, branches, main, shown=None)
    if main in shown:
        return {
            'structure': STRUCTURE_OF_GOD[ten_god(day_master, main)],
            'by': 'main_qi_shows',
            'stem': main,
            'because': None,
        }
    if (
        len(hidden) > 1
        and hidden[1] in shown
        and ten_god(day_master, hidden[1]) not in _OWN
    ):
        middle = hidden[1]
        keeper = _keeper(shown, main, middle)
        if keeper is not None:
            return {
                'structure': STRUCTURE_OF_GOD[ten_god(day_master, main)],
                'by': 'main_qi_kept',
                'stem': main,
                'because': keeper,
            }
        return {
            'structure': STRUCTURE_OF_GOD[ten_god(day_master, middle)],
            'by': 'middle_qi_shows',
            'stem': middle,
            'because': None,
        }
    return _by_combination(day_master, month, branches, main, shown=shown)


def _by_combination(
    day_master: str,
    month: str,
    branches: Sequence[str],
    main: str,
    *,
    shown: Sequence[str] | None,
) -> Naming:
    """A full three-way combination with the month names it; else the main qi. Outside
    the mixed months (`shown` given), one into the Day Master's own element gives way
    to a shown stem that keeps the main qi."""
    combination = full_combination(month, branches)
    if combination is not None:
        stem = hidden_stems_lookup()[combination[1]][0]
        god = ten_god(day_master, stem)
        keeper = (
            _keeper(shown, main, stem) if shown is not None and god in _OWN else None
        )
        if keeper is not None:
            return {
                'structure': STRUCTURE_OF_GOD[ten_god(day_master, main)],
                'by': 'main_qi_kept',
                'stem': main,
                'because': keeper,
            }
        return {
            'structure': STRUCTURE_OF_GOD[god],
            'by': 'combination',
            'stem': stem,
            'because': combination,
        }
    return {
        'structure': STRUCTURE_OF_GOD[ten_god(day_master, main)],
        'by': 'main_qi',
        'stem': main,
        'because': None,
    }


# ── What a structure favours: its chapter on choosing luck (取运) ──

# The text's verdict on a god a period brings, by its own words (docs/Today.md): most
# favourable (最宜, 最利, 最喜), favourable (喜, 宜, 利, 吉…), idle (不碍, 不忌…, or not
# named), against (不利, 不美, 非吉…) and strongly against (忌, 切忌, 凶, 灾…).
Verdict = Literal['most', 'favourable', 'idle', 'against', 'strongly_against']
VERDICTS: Final[tuple[Verdict, ...]] = (
    'most',
    'favourable',
    'idle',
    'against',
    'strongly_against',
)


def element_of_god(day_master: str, god: TenGodName) -> ElementName:
    own = element_of(day_master)
    elements: dict[TenGodName, ElementName] = {
        'friend': own,
        'rob_wealth': own,
        'eating_god': generates(own),
        'hurting_officer': generates(own),
        'indirect_wealth': generates(generates(own)),
        'direct_wealth': generates(generates(own)),
        'seven_killings': controller_of(own),
        'direct_officer': controller_of(own),
        'indirect_resource': generator_of(own),
        'direct_resource': generator_of(own),
    }
    return elements[god]


@dataclass(frozen=True)
class Facts:
    """What the cases ask of a natal chart."""

    day_master: str
    # The stems the chart shows besides its Day Master, year first, and their gods.
    shown: tuple[str, ...]
    shown_gods: Gods
    branches: tuple[str, ...]
    # Each god's count as Support and restrain counts elements: every stem in full and
    # every hidden stem by its qi, each times its element's standing at the birth. The
    # Day Master's own stem counts as its Friend. In hundredths.
    tally: Mapping[TenGodName, int]

    @property
    def free_gods(self) -> Gods:
        """The gods of the shown stems no stem beside them combines away: such a pair is
        taken away (戊癸作合，财印两失; 壬财丁印，二者相合，仍以孤官无辅论)."""
        bound = _bound(self.shown)
        return tuple(
            god for index, god in enumerate(self.shown_gods) if index not in bound
        )

    def show(self, gods: Gods) -> bool:
        """Shown in a stem that is not combined away."""
        return any(god in gods for god in self.free_gods)

    def shown_count(self, gods: Gods) -> int:
        return sum(god in gods for god in self.free_gods)

    def weight(self, gods: Gods) -> int:
        return sum(self.tally[god] for god in gods)

    def heavier(self, these: Gods, those: Gods) -> bool:
        return self.weight(these) > self.weight(those)

    @property
    def weak(self) -> bool:
        """Support and restrain's weak Day Master: its support under half the count."""
        return self.weight(SUPPORT) * 2 < sum(self.tally.values())

    def combined(self, these: Gods, those: Gods) -> bool:
        """A shown stem of these gods combines (五合) with a shown stem of those: the
        cases about a combination ask this, not whether the combined god shows."""
        pairs = list(zip(self.shown, self.shown_gods, strict=True))
        return any(
            frozenset((stem_a, stem_b)) in COMBINING
            for index_a, (stem_a, god_a) in enumerate(pairs)
            for index_b, (stem_b, god_b) in enumerate(pairs)
            if index_a != index_b and god_a in these and god_b in those
        )

    def present(self, gods: Gods) -> bool:
        """Shown in a stem, or the main qi of a branch."""
        return self.show(gods) or any(
            ten_god(self.day_master, hidden_stems_lookup()[branch][0]) in gods
            for branch in self.branches
        )

    def rooted(self, gods: Gods) -> bool:
        """These gods' element is a branch's main qi (根)."""
        elements = {element_of_god(self.day_master, god) for god in gods}
        return any(
            element_of(hidden_stems_lookup()[branch][0]) in elements
            for branch in self.branches
        )


def chart_facts(
    pillars: Mapping[str, tuple[str, str]],
    birth_standings: Mapping[ElementName, Standing],
) -> Facts:
    day_master = pillars['day'][0]
    tally = dict.fromkeys(ten_gods_lookup().values(), 0)
    for name in PILLAR_NAMES:
        stem, branch = pillars[name]
        tally[ten_god(day_master, stem)] += (
            STEM_TENTHS * STANDING_TENTHS[birth_standings[element_of(stem)]]
        )
        for hidden, qi in zip(hidden_stems_lookup()[branch], QI_NAMES, strict=False):
            tally[ten_god(day_master, hidden)] += (
                QI_TENTHS[qi] * STANDING_TENTHS[birth_standings[element_of(hidden)]]
            )
    shown = tuple(_shown(pillars))
    return Facts(
        day_master=day_master,
        shown=shown,
        shown_gods=tuple(ten_god(day_master, stem) for stem in shown),
        branches=tuple(_branches(pillars)),
        tally=tally,
    )


# ── Charts this school does not read ──

# Why this school does not read a chart.
Unreadable = Literal['month_without_use', 'broken', 'following', 'transformation']


def unreadable(
    pillars: Mapping[str, tuple[str, str]], naming: Naming, facts: Facts
) -> Unreadable | None:
    """Why the school does not read the chart, or None when it does.

    - **A month without a use** (论外格用舍: 外格者，盖因月令无用，权而用之): a Jian Lu Yue
      Jie or Yang Blade month with no Wealth, Officer, Killings or Output shown in a
      stem or joined in a full three-way combination (必看四柱有无财官煞食透干会支，另取
      用神). Those are the outer structures (外格), which the school does not judge.
    - **Broken** (论用神成败救应): 建禄月劫，无财官，透煞印，建禄月劫之格败也 (a Jian Lu
      month showing both Killings and Resource, with no Wealth or Direct Officer, nor
      Output to control the Killings, shown or held as a branch's main qi), and
      阳刃无官煞，刃格败也 (a Yang Blade with no Officer or Killings). 透煞印 is both:
      the text reads Lu months that show Resource alone as outer (吴相公's 曲直, 郭统制's
      井拦), and 徐乐吾 reads the line as 煞生印，转而生身.
    - **Following**: no Companion or Resource anywhere but the Day Master's own stem, as
      Support and restrain finds it (论杂格: 弃命从财, 弃命从煞).
    - **Transformation** (从化): the Day Master combined with the month or hour stem
      into an element whose three-way or directional combination the month belongs to,
      with all three branches in the chart: 要化出之物，得时乘令，四支局全.
    """
    day_master = pillars['day'][0]
    structure = naming['structure']
    if structure in ('jian_lu_yue_jie', 'yang_blade'):
        uses = {element_of_god(day_master, god) for god in OUTPUT + WEALTH + OFFICERS}
        joined = any(
            all(branch in facts.branches for branch in combination)
            and element_of(hidden_stems_lookup()[combination[1]][0]) in uses
            for combination in COMBINATIONS
        )
        if not facts.show(OUTPUT + WEALTH + OFFICERS) and not joined:
            return 'month_without_use'
        # A god held as a branch's main qi counts too: 官煞藏而不露 (论阳刃).
        if (
            structure == 'jian_lu_yue_jie'
            and not joined
            and facts.show(KILLINGS)
            and facts.show(RESOURCE)
            and not facts.present(WEALTH + OFFICER + OUTPUT)
        ):
            return 'broken'
        if structure == 'yang_blade' and not facts.present(OFFICERS):
            return 'broken'
    if not _supported_beyond_day_master(pillars):
        return 'following'
    month = pillars['month'][1]
    for neighbour in (pillars['month'][0], pillars['hour'][0]):
        element = COMBINING.get(frozenset((day_master, neighbour)))
        if element is None:
            continue
        groups = [
            combination
            for combination in COMBINATIONS
            if element_of(hidden_stems_lookup()[combination[1]][0]) == element
        ]
        groups += [direction for direction, of in DIRECTIONS.items() if of == element]
        if any(
            month in group and all(branch in facts.branches for branch in group)
            for group in groups
        ):
            return 'transformation'
    return None


def _supported_beyond_day_master(pillars: Mapping[str, tuple[str, str]]) -> bool:
    """A Companion or Resource anywhere in the chart but the Day Master's own stem."""
    day_master = pillars['day'][0]
    support = {element_of(day_master), generator_of(element_of(day_master))}
    for name in PILLAR_NAMES:
        stem, branch = pillars[name]
        if name != 'day' and element_of(stem) in support:
            return True
        if any(
            element_of(hidden) in support for hidden in hidden_stems_lookup()[branch]
        ):
            return True
    return False


# ── The cases ──

# A god or gods, the text's verdict on them, and the word that gives it.
Rule = tuple[Gods, Verdict, str]


def rule(gods: Gods, verdict: Verdict, word: str) -> Rule:
    return (gods, verdict, word)


@dataclass(frozen=True)
class LuckCase:
    id: str
    # The sentence that sets the case, word for word.
    text: str
    applies: Callable[[Facts], bool]
    rules: Callable[[Facts], list[Rule]]


def _always(facts: Facts) -> bool:
    del facts
    return True


# 论正官取运
_DIRECT_OFFICER: Final[tuple[LuckCase, ...]] = (
    LuckCase(
        'killings_combined_by_rob',
        '其命中用劫合煞，则财运可行，伤食可行，身旺，印绶亦可行，只不过复露七煞。',
        lambda f: f.combined(ROB, KILLINGS),
        lambda f: [
            rule(WEALTH, 'favourable', '可行'),
            rule(OUTPUT, 'favourable', '可行'),
            rule(COMPANIONS, 'favourable', '身旺'),
            rule(RESOURCE, 'favourable', '可行'),
            rule(KILLINGS, 'against', '只不过复露七煞'),
        ],
    ),
    LuckCase(
        'killings_combined_by_hurting_officer',
        '若命用伤官合煞，则伤食与财俱可行，而不宜逢印矣。',
        lambda f: f.combined(HURTING, KILLINGS),
        lambda f: [
            rule(OUTPUT + WEALTH, 'favourable', '俱可行'),
            rule(RESOURCE, 'against', '不宜'),
        ],
    ),
    LuckCase(
        'killings',
        '正官而带煞，伤食反为不碍。',
        lambda f: f.show(KILLINGS),
        lambda f: [rule(OUTPUT, 'idle', '不碍')],
    ),
    LuckCase(
        'output_and_resource',
        '正官带伤食而用印制，运喜官旺印旺之乡，财运切忌。若印绶叠出，财运亦无害矣。',
        lambda f: f.show(OUTPUT) and f.show(RESOURCE),
        lambda f: [
            rule(OFFICER + RESOURCE, 'favourable', '喜'),
            rule(WEALTH, 'idle', '无害')
            if f.shown_count(RESOURCE) > 1
            else rule(WEALTH, 'strongly_against', '切忌'),
        ],
    ),
    LuckCase(
        'wealth_and_resource',
        '正官而用财印，身稍轻则取助身，官稍轻则助官。',
        lambda f: f.show(WEALTH) and f.show(RESOURCE),
        lambda f: (
            [rule(COMPANIONS, 'favourable', '助身')]
            if f.weak
            else [rule(OFFICER, 'favourable', '助官')]
        ),
    ),
    LuckCase(
        'wealth',
        '正官用财，运喜印绶身旺之地，切忌食伤。若身旺而财轻官弱，即仍取财官运可也。',
        lambda f: f.show(WEALTH),
        lambda f: (
            [
                rule(RESOURCE + COMPANIONS, 'favourable', '喜'),
                rule(OUTPUT, 'strongly_against', '切忌'),
            ]
            + (
                [rule(WEALTH + OFFICER, 'favourable', '可也')]
                if not f.weak
                and f.heavier(SUPPORT, WEALTH)
                and f.heavier(SUPPORT, OFFICERS)
                else []
            )
        ),
    ),
    LuckCase(
        'resource',
        '正官佩印，运喜财乡，伤食反吉。若官重身轻而佩印，则身旺为宜，不必财运也。',
        lambda f: f.show(RESOURCE),
        lambda f: (
            [rule(OUTPUT, 'favourable', '反吉')]
            + (
                [rule(COMPANIONS, 'favourable', '为宜'), rule(WEALTH, 'idle', '不必')]
                if f.weak and f.heavier(OFFICERS, SUPPORT)
                else [rule(WEALTH, 'favourable', '喜')]
            )
        ),
    ),
)

# 论财取运
_WEALTH: Final[tuple[LuckCase, ...]] = (
    LuckCase(
        'killings_and_resource',
        '财用煞印，印旺最宜，逢财必忌。伤食之方，亦任意矣。',
        lambda f: f.show(KILLINGS) and f.show(RESOURCE),
        lambda f: [
            rule(RESOURCE, 'most', '最宜'),
            rule(WEALTH, 'strongly_against', '必忌'),
            rule(OUTPUT, 'idle', '亦任意'),
        ],
    ),
    LuckCase(
        'killings',
        '财带七煞。不论合煞制煞，运喜食伤身旺之方。',
        lambda f: f.show(KILLINGS),
        lambda f: [rule(OUTPUT + COMPANIONS, 'favourable', '喜')],
    ),
    LuckCase(
        'officer',
        '其财旺生官者，运喜身旺印绶，不利七煞伤官；若生官而后透印，伤官之地，不甚有害。'
        '至于生官而带食破局，则运喜印绶，而逢煞反吉矣。',
        lambda f: f.show(OFFICER),
        lambda f: [
            rule(COMPANIONS + RESOURCE, 'favourable', '喜'),
            rule(KILLINGS, 'favourable', '反吉')
            if f.show(EATING)
            else rule(KILLINGS, 'against', '不利'),
            rule(HURTING, 'idle', '不甚有害')
            if f.show(RESOURCE)
            else rule(HURTING, 'against', '不利'),
        ],
    ),
    LuckCase(
        'hurting_officer',
        '财带伤官，财运则亨，煞运不利，运行官印，未见其美矣。',
        lambda f: f.show(HURTING),
        lambda f: [
            rule(WEALTH, 'favourable', '亨'),
            rule(KILLINGS, 'against', '不利'),
            rule(OFFICER + RESOURCE, 'against', '未见其美'),
        ],
    ),
    LuckCase(
        'eating_god_and_resource',
        '财用食印，财轻则喜财食，身轻则喜比印，官运有碍，煞反不忌也。',
        lambda f: f.show(EATING) and f.show(RESOURCE),
        lambda f: (
            (
                [rule(WEALTH + EATING, 'favourable', '喜')]
                if f.heavier(SUPPORT, WEALTH)
                else []
            )
            + ([rule(COMPANIONS + RESOURCE, 'favourable', '喜')] if f.weak else [])
            + [rule(OFFICER, 'against', '有碍'), rule(KILLINGS, 'idle', '不忌')]
        ),
    ),
    LuckCase(
        'eating_god',
        '财用食生，财食重而身轻，则喜助身；财食轻而身重，则仍行财食。煞运不忌，官印反晦矣。',
        lambda f: f.show(EATING),
        lambda f: (
            (
                [rule(COMPANIONS, 'favourable', '喜')]
                if f.weak and f.heavier(WEALTH + EATING, SUPPORT)
                else [rule(WEALTH + EATING, 'favourable', '仍行')]
                if not f.weak and f.heavier(SUPPORT, WEALTH + EATING)
                else []
            )
            + [
                rule(KILLINGS, 'idle', '不忌'),
                rule(OFFICER + RESOURCE, 'against', '反晦'),
            ]
        ),
    ),
    LuckCase(
        'resource',
        '财格佩印，运喜官乡，身弱逢之，最喜印旺。',
        lambda f: f.show(RESOURCE),
        lambda f: (
            [rule(OFFICER, 'favourable', '喜')]
            + ([rule(RESOURCE, 'most', '最喜')] if f.weak else [])
        ),
    ),
)

# 论印绶取运
_RESOURCE: Final[tuple[LuckCase, ...]] = (
    LuckCase(
        'officer_and_killings',
        '印格而官煞竞透，运喜食神伤官，印旺身旺，行之亦利。若再透官煞，行财运，立见其灾矣。',
        lambda f: f.show(OFFICER) and f.show(KILLINGS),
        lambda f: [
            rule(OUTPUT, 'favourable', '喜'),
            rule(RESOURCE + COMPANIONS, 'favourable', '亦利'),
            rule(OFFICERS + WEALTH, 'strongly_against', '立见其灾'),
        ],
    ),
    LuckCase(
        'killings_and_output',
        '若用煞而兼带伤食，运喜身旺印绶之方，伤食亦美，逢官遇财，皆不吉也。',
        lambda f: f.show(KILLINGS) and f.show(OUTPUT),
        lambda f: [
            rule(COMPANIONS + RESOURCE, 'favourable', '喜'),
            rule(OUTPUT, 'favourable', '亦美'),
            rule(OFFICER + WEALTH, 'against', '不吉'),
        ],
    ),
    LuckCase(
        'killings',
        '印用七煞，运喜伤食，身旺之方，亦为美地，一见财乡，其凶立至。',
        lambda f: f.show(KILLINGS),
        lambda f: [
            rule(OUTPUT, 'favourable', '喜'),
            rule(COMPANIONS, 'favourable', '亦为美地'),
            rule(WEALTH, 'strongly_against', '其凶立至'),
        ],
    ),
    LuckCase(
        'officer_and_output',
        '若用官而带伤食，运喜官旺印绶之乡，伤食为害，逢煞不忌矣。',
        lambda f: f.show(OFFICER) and f.show(OUTPUT),
        lambda f: [
            rule(OFFICER + RESOURCE, 'favourable', '喜'),
            rule(OUTPUT, 'against', '为害'),
            rule(KILLINGS, 'idle', '不忌'),
        ],
    ),
    LuckCase(
        'wealth',
        '印绶遇财，运喜劫地，官印亦亨，财乡则忌。',
        lambda f: f.show(WEALTH),
        lambda f: [
            rule(ROB, 'favourable', '喜'),
            rule(OFFICER + RESOURCE, 'favourable', '亦亨'),
            rule(WEALTH, 'strongly_against', '忌'),
        ],
    ),
    LuckCase(
        'output',
        '印绶而用伤食，财运反吉，伤食亦利，若行官运，反见其灾，煞运则反能为福矣。',
        lambda f: f.show(OUTPUT),
        lambda f: [
            # 印用食伤，印轻者亦不利见财也.
            rule(WEALTH, 'against', '印轻者亦不利见财')
            if f.heavier(OUTPUT, RESOURCE)
            else rule(WEALTH, 'favourable', '反吉'),
            rule(OUTPUT, 'favourable', '亦利'),
            rule(OFFICER, 'strongly_against', '反见其灾'),
            rule(KILLINGS, 'favourable', '反能为福'),
        ],
    ),
    LuckCase(
        'officer_resource_heavy',
        '其印绶用官者，官露印重，财运反吉，伤食之方，亦为最利。',
        lambda f: f.show(OFFICER) and f.heavier(RESOURCE, OFFICERS),
        lambda f: [rule(WEALTH, 'favourable', '反吉'), rule(OUTPUT, 'most', '最利')],
    ),
)

# 论食神取运
_EATING_GOD: Final[tuple[LuckCase, ...]] = (
    LuckCase(
        'killings_and_resource',
        '食用煞印，运喜印旺，切忌财乡。身旺，食伤亦为福运，行官行煞，亦为吉也。',
        lambda f: f.show(KILLINGS) and f.show(RESOURCE),
        lambda f: [
            rule(RESOURCE, 'favourable', '喜'),
            rule(COMPANIONS + OUTPUT, 'favourable', '亦为福运'),
            rule(OFFICERS, 'favourable', '亦为吉'),
            rule(WEALTH, 'strongly_against', '切忌'),
        ],
    ),
    LuckCase(
        'killings',
        '食伤带煞，喜行印绶，身旺，食伤亦为美运，财则最忌。若食太重而煞轻，印运最利，逢财反吉矣。',
        lambda f: f.show(KILLINGS),
        lambda f: (
            [rule(COMPANIONS + OUTPUT, 'favourable', '亦为美运')]
            + (
                [rule(RESOURCE, 'most', '最利'), rule(WEALTH, 'favourable', '反吉')]
                if f.heavier(OUTPUT, KILLINGS)
                else [
                    rule(RESOURCE, 'favourable', '喜'),
                    rule(WEALTH, 'strongly_against', '最忌'),
                ]
            )
        ),
    ),
    LuckCase(
        'resource_and_wealth',
        '若食神带印，透财以解，运喜财旺，食伤亦吉，印与官煞皆忌也。',
        lambda f: f.show(RESOURCE) and f.show(WEALTH),
        lambda f: [
            rule(WEALTH, 'favourable', '喜'),
            rule(OUTPUT, 'favourable', '亦吉'),
            rule(RESOURCE + OFFICERS, 'strongly_against', '皆忌'),
        ],
    ),
    LuckCase(
        'resource_output_strong',
        '食神太旺而带印，运最利财，食伤亦吉，印则最忌，官煞皆不吉也。',
        lambda f: f.show(RESOURCE) and f.heavier(OUTPUT, SUPPORT),
        lambda f: [
            rule(WEALTH, 'most', '最利'),
            rule(OUTPUT, 'favourable', '亦吉'),
            rule(RESOURCE, 'strongly_against', '最忌'),
            rule(OFFICERS, 'against', '不吉'),
        ],
    ),
    LuckCase(
        'wealth',
        '食神生财，财食轻，则行财食，财食重则喜帮身。官煞之方，俱为不美。',
        lambda f: f.show(WEALTH),
        lambda f: [
            rule(COMPANIONS, 'favourable', '喜')
            if f.heavier(WEALTH + EATING, SUPPORT)
            else rule(WEALTH + EATING, 'favourable', '行'),
            rule(OFFICERS, 'against', '不美'),
        ],
    ),
)

# 论偏官取运
_SEVEN_KILLINGS: Final[tuple[LuckCase, ...]] = (
    LuckCase(
        'officer',
        '煞带正官，不论去官留煞，去煞留官，身轻则喜助身，食轻则喜助食。',
        lambda f: f.show(OFFICER),
        lambda f: (
            ([rule(COMPANIONS, 'favourable', '喜')] if f.weak else [])
            + (
                [rule(OUTPUT, 'favourable', '喜')]
                if f.heavier(KILLINGS, OUTPUT)
                else []
            )
        ),
    ),
    LuckCase(
        'wealth_clears_resource',
        '七煞用财，其以财而去印存食者，不利劫财，伤食皆吉，喜财怕印，透煞亦顺。',
        lambda f: f.show(WEALTH) and f.show(RESOURCE) and f.show(OUTPUT),
        lambda f: [
            rule(ROB, 'against', '不利'),
            rule(OUTPUT, 'favourable', '皆吉'),
            rule(WEALTH, 'favourable', '喜'),
            rule(RESOURCE, 'against', '怕'),
            rule(KILLINGS, 'favourable', '亦顺'),
        ],
    ),
    LuckCase(
        'output',
        '煞用食制，煞重食轻则助食，煞轻食重则助煞，煞食均而日主根轻则助身。'
        '忌正官之混杂，畏印绶之夺食。',
        lambda f: f.show(OUTPUT),
        lambda f: (
            (
                [rule(OUTPUT, 'favourable', '助食')]
                if f.heavier(KILLINGS, OUTPUT)
                else [rule(KILLINGS, 'favourable', '助煞')]
                if f.heavier(OUTPUT, KILLINGS)
                else [rule(COMPANIONS, 'favourable', '助身')]
                if f.weak
                else []
            )
            + [rule(OFFICER, 'strongly_against', '忌'), rule(RESOURCE, 'against', '畏')]
        ),
    ),
    LuckCase(
        'resource',
        '煞用印绶，不利财乡，伤官为美，印绶身旺，俱为福地。',
        lambda f: f.show(RESOURCE),
        lambda f: [
            rule(WEALTH, 'against', '不利'),
            rule(HURTING, 'favourable', '为美'),
            rule(RESOURCE + COMPANIONS, 'favourable', '俱为福地'),
        ],
    ),
    LuckCase(
        'wealth_helps_killings',
        '其以财而助煞不及者，财已足，则喜食印与帮身；财未足，则喜财旺而露煞。',
        lambda f: f.show(WEALTH) and f.heavier(SUPPORT, KILLINGS),
        lambda f: (
            [rule(OUTPUT + RESOURCE + COMPANIONS, 'favourable', '喜')]
            if f.heavier(WEALTH, KILLINGS)
            else [rule(WEALTH + KILLINGS, 'favourable', '喜')]
        ),
    ),
    LuckCase(
        'rob_wealth_against_killings',
        '煞无食制而用刃当煞，煞轻刃重则喜助煞，刃轻煞重，则宜制伏，无食可夺，印运何伤？'
        '七煞既纯，杂官不利。',
        lambda f: not f.show(OUTPUT) and f.show(ROB),
        lambda f: [
            rule(KILLINGS, 'favourable', '喜助煞')
            if f.heavier(COMPANIONS, KILLINGS)
            else rule(OUTPUT, 'favourable', '宜制伏'),
            rule(RESOURCE, 'idle', '何伤'),
            rule(OFFICER, 'against', '不利'),
        ],
    ),
)

# 论伤官取运
_HURTING_OFFICER: Final[tuple[LuckCase, ...]] = (
    LuckCase(
        'killings_and_resource',
        '伤官而用煞印，印运最利，伤食亦亨，杂官非吉，逢财即危。',
        lambda f: f.show(KILLINGS) and f.show(RESOURCE),
        lambda f: [
            rule(RESOURCE, 'most', '最利'),
            rule(OUTPUT, 'favourable', '亦亨'),
            rule(OFFICER, 'against', '非吉'),
            rule(WEALTH, 'strongly_against', '即危'),
        ],
    ),
    LuckCase(
        'killings',
        '伤官带煞，喜印忌财，然伤重煞轻，运喜印而财亦吉。惟七煞根重，则运喜伤食，印绶身旺亦吉，'
        '而逢财为凶矣。',
        lambda f: f.show(KILLINGS),
        lambda f: (
            [
                rule(OUTPUT, 'favourable', '喜'),
                rule(RESOURCE + COMPANIONS, 'favourable', '亦吉'),
                rule(WEALTH, 'strongly_against', '为凶'),
            ]
            if f.rooted(KILLINGS)
            else [
                rule(RESOURCE, 'favourable', '喜'),
                rule(WEALTH, 'favourable', '亦吉'),
            ]
            if f.heavier(HURTING, KILLINGS)
            else [
                rule(RESOURCE, 'favourable', '喜'),
                rule(WEALTH, 'strongly_against', '忌'),
            ]
        ),
    ),
    LuckCase(
        'wealth_and_resource',
        '伤官而兼用财印，其财多而带印者，运喜助印，印多而带财者，运喜助财。',
        lambda f: f.show(WEALTH) and f.show(RESOURCE),
        lambda f: (
            [rule(RESOURCE, 'favourable', '喜')]
            if f.heavier(WEALTH, RESOURCE)
            else [rule(WEALTH, 'favourable', '喜')]
            if f.heavier(RESOURCE, WEALTH)
            else []
        ),
    ),
    LuckCase(
        'resource',
        '伤官佩印，运行官煞为宜，印运亦吉，伤食不碍，财地则凶。',
        lambda f: f.show(RESOURCE),
        lambda f: [
            rule(OFFICERS, 'favourable', '为宜'),
            rule(RESOURCE, 'favourable', '亦吉'),
            rule(OUTPUT, 'idle', '不碍'),
            rule(WEALTH, 'strongly_against', '凶'),
        ],
    ),
    LuckCase(
        'wealth',
        '伤官用财，财旺身轻，则利印比；身强财浅，则喜财运，伤官亦宜。',
        lambda f: f.show(WEALTH),
        lambda f: (
            [rule(RESOURCE + COMPANIONS, 'favourable', '利')]
            if f.weak and f.heavier(WEALTH, SUPPORT)
            else [rule(WEALTH, 'favourable', '喜'), rule(HURTING, 'favourable', '亦宜')]
            if not f.weak and f.heavier(SUPPORT, WEALTH)
            else []
        ),
    ),
    LuckCase(
        'officer_metal',
        '伤官用官，运喜财印，不利食伤，若局中官露而财印两旺，则比劫伤官，未始非吉矣。',
        lambda f: f.show(OFFICER) and element_of(f.day_master) == 'metal',
        # 财印两旺: Wealth outweighs the Companions that would take it, and Resource
        # the Output that would hurt the Officer.
        lambda f: (
            [
                rule(WEALTH + RESOURCE, 'favourable', '喜'),
                rule(OUTPUT, 'against', '不利'),
            ]
            + (
                [rule(COMPANIONS + HURTING, 'favourable', '未始非吉')]
                if f.heavier(WEALTH, COMPANIONS) and f.heavier(RESOURCE, OUTPUT)
                else []
            )
        ),
    ),
)

# 论阳刃取运
_YANG_BLADE: Final[tuple[LuckCase, ...]] = (
    LuckCase(
        'officer_and_killings',
        '阳刃而官煞并出，不论去官去煞，运喜制伏，身旺亦利，财地官乡反为不吉也。',
        lambda f: f.show(OFFICER) and f.show(KILLINGS),
        lambda f: [
            rule(OUTPUT, 'favourable', '喜'),
            rule(COMPANIONS, 'favourable', '亦利'),
            rule(WEALTH + OFFICER, 'against', '不吉'),
        ],
    ),
    LuckCase(
        'killings',
        '阳刃用煞，煞不甚旺，则运喜助煞；煞若太重，则运喜身旺印绶，伤食亦不为忌。',
        lambda f: f.show(KILLINGS),
        lambda f: (
            [
                rule(COMPANIONS + RESOURCE, 'favourable', '喜'),
                rule(OUTPUT, 'idle', '不为忌'),
            ]
            if f.heavier(KILLINGS, SUPPORT)
            else [rule(KILLINGS, 'favourable', '喜')]
        ),
    ),
    LuckCase(
        'officer',
        '阳刃用官，则运喜助官，然命中官星根深，则印绶比劫之方，反为美运，但不喜伤食合官耳。',
        lambda f: f.show(OFFICER),
        lambda f: (
            [rule(OFFICER, 'favourable', '喜')]
            + (
                [rule(RESOURCE + COMPANIONS, 'favourable', '反为美运')]
                if f.rooted(OFFICER)
                else []
            )
            + [rule(EATING, 'against', '不喜伤食合官')]
        ),
    ),
)

# 论建禄月劫取运
_JIAN_LU_YUE_JIE: Final[tuple[LuckCase, ...]] = (
    LuckCase(
        'officer_and_killings',
        '禄劫而官煞并出，不论合煞留官，存官制煞，运喜伤食，比肩亦宜，印绶未为良图，财官亦非福运。',
        lambda f: f.show(OFFICER) and f.show(KILLINGS),
        lambda f: [
            rule(OUTPUT, 'favourable', '喜'),
            rule(FRIEND, 'favourable', '亦宜'),
            rule(RESOURCE, 'against', '未为良图'),
            rule(WEALTH + OFFICER, 'against', '亦非福运'),
        ],
    ),
    LuckCase(
        'killings_combined_wealth_kept',
        '若用煞而带财，命中合煞存财，则伤食为宜，财运不忌，透官无虑，身旺亦亨。',
        lambda f: f.show(WEALTH) and f.combined(tuple(_ALL_GODS), KILLINGS),
        lambda f: [
            rule(OUTPUT, 'favourable', '为宜'),
            rule(WEALTH, 'idle', '不忌'),
            rule(OFFICER, 'idle', '无虑'),
            rule(COMPANIONS, 'favourable', '亦亨'),
        ],
    ),
    LuckCase(
        'wealth_combined_killings_kept',
        '若命中合财存煞，而用食制，煞轻则助煞，食轻则助食则已。',
        lambda f: f.show(KILLINGS) and f.combined(tuple(_ALL_GODS), WEALTH),
        lambda f: (
            [rule(KILLINGS, 'favourable', '助煞')]
            if f.heavier(OUTPUT, KILLINGS)
            else [rule(OUTPUT, 'favourable', '助食')]
            if f.heavier(KILLINGS, OUTPUT)
            else []
        ),
    ),
    LuckCase(
        'killings_and_output',
        '禄劫用煞食制，食重煞轻，则运宜助煞；食轻煞重，则运喜助食。',
        lambda f: f.show(KILLINGS) and f.show(OUTPUT),
        lambda f: (
            [rule(KILLINGS, 'favourable', '宜')]
            if f.heavier(OUTPUT, KILLINGS)
            else [rule(OUTPUT, 'favourable', '喜')]
            if f.heavier(KILLINGS, OUTPUT)
            else []
        ),
    ),
    LuckCase(
        'officer_and_resource',
        '禄劫用官，印护者喜财，怕官星之逢合，畏七煞之相乘。伤食不能为害，劫比未即为凶。',
        lambda f: f.show(OFFICER) and f.show(RESOURCE),
        # The stem that combines the Officer is feared, though Output and Companions as
        # such do no harm.
        lambda f: [
            rule(WEALTH, 'favourable', '喜'),
            rule(KILLINGS, 'against', '畏'),
            rule(OUTPUT, 'idle', '不能为害'),
            rule(COMPANIONS, 'idle', '未即为凶'),
            rule((_combiner_of_officer(f.day_master),), 'against', '怕官星之逢合'),
        ],
    ),
    LuckCase(
        'officer_and_wealth',
        '财生喜印，宜官星之植根，畏伤食之相侮，逢财愈见其功，杂煞岂能无碍？',
        lambda f: f.show(OFFICER) and f.show(WEALTH),
        lambda f: [
            rule(RESOURCE, 'favourable', '喜'),
            rule(OFFICER, 'favourable', '宜'),
            rule(OUTPUT, 'against', '畏'),
            rule(WEALTH, 'favourable', '愈见其功'),
            rule(KILLINGS, 'against', '岂能无碍'),
        ],
    ),
    LuckCase(
        'wealth_and_output',
        '禄劫用财而带伤食，财食重则喜印绶，而不忌比肩；财食轻则宜助财，而不喜印比。逢煞无伤，遇官非福。',
        lambda f: f.show(WEALTH) and f.show(OUTPUT),
        lambda f: (
            (
                [rule(RESOURCE, 'favourable', '喜'), rule(FRIEND, 'idle', '不忌')]
                if f.heavier(WEALTH + OUTPUT, SUPPORT)
                else [
                    rule(WEALTH, 'favourable', '宜'),
                    rule(RESOURCE + COMPANIONS, 'against', '不喜'),
                ]
            )
            + [rule(KILLINGS, 'idle', '无伤'), rule(OFFICER, 'against', '非福')]
        ),
    ),
    LuckCase(
        'output',
        '禄劫而用伤食，财运最宜，煞亦不忌，行印非吉，透官不美。若命中伤食太重，则财运固利，而印亦不忌矣。',
        lambda f: f.show(OUTPUT),
        lambda f: (
            [rule(KILLINGS, 'idle', '不忌'), rule(OFFICER, 'against', '不美')]
            + (
                [rule(WEALTH, 'favourable', '固利'), rule(RESOURCE, 'idle', '不忌')]
                if f.heavier(OUTPUT, SUPPORT)
                else [rule(WEALTH, 'most', '最宜'), rule(RESOURCE, 'against', '非吉')]
            )
        ),
    ),
)

_ALL_GODS: Final[Gods] = COMPANIONS + OUTPUT + WEALTH + OFFICERS + RESOURCE

LUCK_CASES: Final[dict[StructureName, tuple[LuckCase, ...]]] = {
    'direct_officer': _DIRECT_OFFICER,
    'wealth': _WEALTH,
    'resource': _RESOURCE,
    'eating_god': _EATING_GOD,
    'seven_killings': _SEVEN_KILLINGS,
    'hurting_officer': _HURTING_OFFICER,
    'yang_blade': _YANG_BLADE,
    'jian_lu_yue_jie': _JIAN_LU_YUE_JIE,
}
LUCK_CHAPTERS: Final[dict[StructureName, str]] = {
    'direct_officer': '论正官取运',
    'wealth': '论财取运',
    'resource': '论印绶取运',
    'eating_god': '论食神取运',
    'seven_killings': '论偏官取运',
    'hurting_officer': '论伤官取运',
    'yang_blade': '论阳刃取运',
    'jian_lu_yue_jie': '论建禄月劫取运',
}

# No case of the chapter applies: the structure's line in 论用神, with what breaks it in
# 论用神成败救应.
GENERAL: Final[dict[StructureName, LuckCase]] = {
    'direct_officer': LuckCase(
        'general',
        '官喜透财以相生，生印以护官……官逢伤克刑冲，官格败也',
        _always,
        lambda f: [
            rule(WEALTH + RESOURCE, 'favourable', '喜'),
            rule(HURTING, 'against', '败'),
        ],
    ),
    'wealth': LuckCase(
        'general',
        '财喜食神以相生，生官以护财……财轻比重，财透七煞，财格败也',
        _always,
        lambda f: [
            rule(EATING + OFFICER, 'favourable', '喜'),
            rule(COMPANIONS + KILLINGS, 'against', '败'),
        ],
    ),
    'resource': LuckCase(
        'general',
        '印喜官煞以相生，劫财以护印……印轻逢财……印格败也',
        _always,
        lambda f: [
            rule(OFFICERS + ROB, 'favourable', '喜'),
            rule(WEALTH, 'against', '败'),
        ],
    ),
    'eating_god': LuckCase(
        'general',
        '食喜身旺以相生，生财以护食……食神逢枭……食神格败也',
        _always,
        lambda f: [
            rule(COMPANIONS + WEALTH, 'favourable', '喜'),
            rule(OWL, 'against', '败'),
        ],
    ),
    'seven_killings': LuckCase(
        'general',
        '七煞喜食神以制伏，忌财印以资扶',
        _always,
        lambda f: [
            rule(EATING, 'favourable', '喜'),
            rule(WEALTH + RESOURCE, 'strongly_against', '忌'),
        ],
    ),
    'hurting_officer': LuckCase(
        'general',
        '伤官喜佩印以制伏，生财以化伤……伤官非金水而见官……伤官格败也',
        _always,
        lambda f: (
            [rule(RESOURCE + WEALTH, 'favourable', '喜')]
            + (
                []
                if element_of(f.day_master) == 'metal'
                else [rule(OFFICER, 'against', '败')]
            )
        ),
    ),
    'yang_blade': LuckCase(
        'general',
        '阳刃喜官煞以制伏，忌官煞之俱无',
        _always,
        lambda f: [rule(OFFICERS, 'favourable', '喜')],
    ),
    'jian_lu_yue_jie': LuckCase(
        'general',
        '月劫喜透官以制伏，利用财而透食以化劫',
        _always,
        lambda f: [
            rule(OFFICER, 'favourable', '喜'),
            rule(WEALTH + EATING, 'favourable', '利'),
        ],
    ),
}
# 论正官取运: wherever the Officer shows, 若官露而不可逢合，不可杂煞，不可重官……皆不利也.
OFFICER_SHOWN: Final[tuple[str, list[Rule]]] = (
    '若官露而不可逢合，不可杂煞，不可重官。与地支刑冲，不问所就何局，皆不利也。',
    [rule(KILLINGS, 'against', '不可杂煞'), rule(OFFICER, 'against', '不可重官')],
)


def _combiner_of_officer(day_master: str) -> TenGodName:
    """The god of the stem that combines (五合) the Day Master's Direct Officer: the
    Eating God for a yang Day Master (丙 with 辛 for 甲), the Day Master's own Friend for a
    yin one (乙 with 庚 for 乙)."""
    officer = next(
        stem for stem in STEM_ORDER if ten_god(day_master, stem) == 'direct_officer'
    )
    partner = next(
        stem for stem in STEM_ORDER if frozenset((officer, stem)) in COMBINING
    )
    return ten_god(day_master, partner)


class Reading(TypedDict):
    naming: Naming
    # Why the school does not read the chart, or None when it does.
    outer: Unreadable | None
    chapter: str | None
    case: str | None
    text: str | None
    # Each Ten God's verdict, and the word of the text that gives it (None: not named).
    verdicts: dict[TenGodName, Verdict] | None
    words: dict[TenGodName, str | None] | None


def read_structure(
    pillars: Mapping[str, tuple[str, str]],
    birth_standings: Mapping[ElementName, Standing],
) -> Reading:
    """The chart's structure and what its chapter on choosing luck favours."""
    naming = name_structure(pillars)
    facts = chart_facts(pillars, birth_standings)
    outer = unreadable(pillars, naming, facts)
    if outer is not None:
        return {
            'naming': naming,
            'outer': outer,
            'chapter': None,
            'case': None,
            'text': None,
            'verdicts': None,
            'words': None,
        }
    case, text, verdicts, words = luck_reading(naming['structure'], facts)
    return {
        'naming': naming,
        'outer': None,
        'chapter': '论用神'
        if case.id == 'general'
        else LUCK_CHAPTERS[naming['structure']],
        'case': case.id,
        'text': text,
        'verdicts': verdicts,
        'words': words,
    }


def luck_reading(
    structure: StructureName, facts: Facts
) -> tuple[LuckCase, str, dict[TenGodName, Verdict], dict[TenGodName, str | None]]:
    """The structure's case, the text that sets it, and each god's verdict and word.

    The first case of the structure's chapter that applies is taken; with none, the
    structure's general line. A god no rule names is idle. A later rule overrides an
    earlier one for the same god, so a case's own words win over 论正官取运's line on a
    shown Officer.
    """
    case = next(
        (case for case in LUCK_CASES[structure] if case.applies(facts)),
        GENERAL[structure],
    )
    rules: list[Rule] = []
    texts = [case.text]
    if structure == 'direct_officer' and facts.show(OFFICER):
        rules += OFFICER_SHOWN[1]
        rules.append(
            rule((_combiner_of_officer(facts.day_master),), 'against', '不可逢合')
        )
        texts.insert(0, OFFICER_SHOWN[0])
    rules += case.rules(facts)
    verdicts: dict[TenGodName, Verdict] = dict.fromkeys(_ALL_GODS, 'idle')
    words: dict[TenGodName, str | None] = dict.fromkeys(_ALL_GODS, None)
    for gods, verdict, word in rules:
        for god in gods:
            verdicts[god] = verdict
            words[god] = word
    return case, ''.join(texts), verdicts, words
