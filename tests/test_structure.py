"""Naming a chart's structure (eight_characters/structure.py) after Zi Ping Zhen Quan,
held to the text's own example charts."""

import unittest
from typing import Final

from eight_characters.structure import (
    BLADE,
    PROSPERITY,
    StructureName,
    full_combination,
    name_structure,
    ten_god,
)

# Every example chart in the text's structure chapters, with the structure the text
# reads it as: the chapter it stands in, or the change the text names (化官为印, 化伤为财).
# Left out: those the text calls a change upon a change (变之又变: 丙辰、丙申、丙午、壬辰
# and 丙午、庚寅、丙午、癸巳), and three garbled in every copy.
EXAMPLES: Final[tuple[tuple[str, str, StructureName], ...]] = (
    # 论正官
    ('薛相公', '甲申 壬申 乙巳 戊寅', 'direct_officer'),
    ('金状元: 化官为印而透财', '乙卯 丁亥 丁未 庚戌', 'resource'),
    ('宣参国', '己卯 辛未 壬寅 辛亥', 'direct_officer'),
    ('李参政', '庚寅 乙酉 甲子 戊辰', 'direct_officer'),
    ('范太傅', '丁丑 壬寅 己巳 丙寅', 'direct_officer'),
    # 论财
    ('葛参政', '壬申 壬子 戊午 乙卯', 'wealth'),
    ('杨待郎', '壬寅 壬寅 庚辰 辛巳', 'wealth'),
    ('曾参政', '乙未 甲申 丙申 庚寅', 'wealth'),
    ('财印两不相能', '乙未 己卯 庚寅 辛巳', 'wealth'),
    ('吴榜眼', '庚戌 戊子 戊子 丙辰', 'wealth'),
    ('平江伯', '壬辰 乙巳 癸巳 辛酉', 'wealth'),
    ('汪学士: 甲透未库', '甲子 辛未 辛酉 壬辰', 'wealth'),
    ('毛状元', '乙酉 庚辰 甲午 戊辰', 'wealth'),
    ('李御史', '庚辰 戊子 戊寅 甲寅', 'wealth'),
    ('林尚书', '丙寅 癸巳 癸未 壬戌', 'wealth'),
    ('王太仆', '丙辰 癸巳 壬戌 壬寅', 'wealth'),
    # 论印绶
    ('张参政', '丙寅 戊戌 辛酉 戊子', 'resource'),
    ('朱尚书', '丙戌 戊戌 辛未 壬辰', 'resource'),
    ('临淮侯', '乙亥 己卯 丁酉 壬寅', 'resource'),
    ('李状元', '戊戌 乙卯 丙午 乙亥', 'resource'),
    ('茅状元', '己巳 癸酉 癸未 庚申', 'resource'),
    ('马参政', '壬寅 戊申 壬辰 壬寅', 'resource'),
    ('汪侍郎', '辛酉 丙申 壬申 辛亥', 'resource'),
    ('牛监薄', '庚寅 乙酉 癸亥 丙辰', 'resource'),
    ('合财存食', '己未 甲戌 辛未 癸巳', 'resource'),
    ('合煞留官', '辛亥 庚子 甲辰 乙亥', 'resource'),
    ('官煞有制', '壬子 癸卯 丙子 己亥', 'resource'),
    ('劫财以存煞印', '庚戌 戊子 甲戌 乙亥', 'resource'),
    # 论食神
    ('梁丞相', '丁未 癸卯 癸亥 癸丑', 'eating_god'),
    ('谢阁老', '己未 壬申 戊子 庚申', 'eating_god'),
    ('沈路分: 藏食露伤', '丁亥 癸卯 癸卯 甲寅', 'eating_god'),
    ('龚知县', '甲午 丁卯 癸丑 丙辰', 'eating_god'),
    ('黄都督', '己未 己巳 甲寅 丙寅', 'eating_god'),
    ('常国公', '辛卯 辛卯 癸酉 己未', 'eating_god'),
    ('胡会元', '戊戌 壬戌 丙子 戊戌', 'eating_god'),
    ('舒尚书', '丁亥 壬子 辛巳 丁酉', 'eating_god'),
    ('钱参政', '丙午 癸巳 甲子 丙寅', 'eating_god'),
    ('刘提台', '癸酉 辛酉 己卯 乙亥', 'eating_god'),
    # 论偏官
    ('极等之贵', '乙亥 乙酉 乙卯 丁丑', 'seven_killings'),
    ('脱丞相: 辰中暗煞，壬以透之', '壬辰 甲辰 丙戌 戊戌', 'seven_killings'),
    ('何参政', '丙寅 戊戌 壬戌 辛丑', 'seven_killings'),
    ('周丞相', '戊戌 甲子 丁未 庚戌', 'seven_killings'),
    ('刘运使: 借财以清格', '甲申 乙亥 丙戌 庚寅', 'seven_killings'),
    ('岳统制', '癸卯 丁巳 庚寅 庚辰', 'seven_killings'),
    ('沈郎中', '丙子 甲午 辛亥 辛卯', 'seven_killings'),
    ('赵员外', '戊辰 甲寅 戊寅 戊午', 'seven_killings'),
    # 论伤官
    ('史春芳', '壬午 己酉 戊午 庚申', 'hurting_officer'),
    ('罗状元: 化伤为财', '甲子 乙亥 辛未 戊子', 'wealth'),
    ('秦龙图', '己卯 丁丑 丙寅 庚寅', 'hurting_officer'),
    ('孛罗平章', '壬申 丙午 甲午 壬申', 'hurting_officer'),
    ('都统制', '丁酉 己酉 戊子 壬子', 'hurting_officer'),
    ('一丞相', '壬戌 己酉 戊午 丁巳', 'hurting_officer'),
    ('蔡贵妃', '己未 丙子 庚子 丙子', 'hurting_officer'),
    ('伤官用官', '戊申 甲子 庚午 丁丑', 'hurting_officer'),
    ('郑丞相', '丙申 己亥 辛未 己亥', 'hurting_officer'),
    ('章丞相: 化伤为财，作财旺生官', '甲子 壬申 己亥 辛未', 'wealth'),
    # 论阳刃
    ('官透有力', '己酉 丙子 壬寅 丙午', 'yang_blade'),
    ('透煞根浅', '辛酉 甲午 丙申 壬辰', 'yang_blade'),
    ('穆同知', '甲午 癸酉 庚寅 戊寅', 'yang_blade'),
    ('贾平章', '甲寅 庚午 戊申 甲寅', 'yang_blade'),
    ('官煞竞出', '丙戌 丁酉 庚申 壬午', 'yang_blade'),
    # 论建禄月劫
    ('金丞相', '庚戌 戊子 癸酉 癸亥', 'jian_lu_yue_jie'),
    ('李知府', '丁酉 丙午 丁巳 壬寅', 'jian_lu_yue_jie'),
    ('王少师', '庚午 戊子 癸卯 丁巳', 'jian_lu_yue_jie'),
    ('张都统', '甲子 丙子 癸丑 壬辰', 'jian_lu_yue_jie'),
    ('化劫为财', '己未 己巳 丁未 辛丑', 'jian_lu_yue_jie'),
    ('高尚书', '庚子 甲申 庚子 甲申', 'jian_lu_yue_jie'),
    ('娄参政', '丁巳 壬子 癸卯 己未', 'jian_lu_yue_jie'),
    ('袁内阁', '戊辰 癸亥 壬午 丙午', 'jian_lu_yue_jie'),
    ('张状元', '甲子 丙寅 甲子 丙寅', 'jian_lu_yue_jie'),
    ('金水相涵', '癸卯 庚申 庚子 庚辰', 'jian_lu_yue_jie'),
    ('一平章', '辛丑 庚寅 甲辰 乙亥', 'jian_lu_yue_jie'),
    ('制煞留官', '辛亥 庚寅 甲申 丙寅', 'jian_lu_yue_jie'),
    ('王总兵', '己酉 乙亥 壬戌 庚子', 'jian_lu_yue_jie'),
    # 论时说以讹传讹: 本杂气财旺生官也; 本食神生财也
    ('杂气财旺生官', '壬申 癸丑 己丑 甲戌', 'wealth'),
    ('食神生财，非合禄', '己未 壬申 戊子 庚申', 'eating_god'),
)


def pillars(chart: str) -> dict[str, tuple[str, str]]:
    year, month, day, hour = chart.split()
    return {
        'year': (year[0], year[1]),
        'month': (month[0], month[1]),
        'day': (day[0], day[1]),
        'hour': (hour[0], hour[1]),
    }


class TestNamingByTheTextsExamples(unittest.TestCase):
    def test_every_example_is_named_as_the_text_names_it(self) -> None:
        for who, chart, structure in EXAMPLES:
            with self.subTest(who=who, chart=chart):
                self.assertEqual(name_structure(pillars(chart))['structure'], structure)


class TestNamingRules(unittest.TestCase):
    def test_the_prosperity_and_the_blade(self) -> None:
        # 金丞相: Gui in Zi, its prosperity; 官透有力: Ren in Zi, its blade.
        self.assertEqual(PROSPERITY['癸'], '子')
        self.assertEqual(name_structure(pillars('庚戌 戊子 癸酉 癸亥'))['by'], 'prosperity')
        self.assertEqual(BLADE['壬'], '子')
        self.assertEqual(name_structure(pillars('己酉 丙子 壬寅 丙午'))['by'], 'blade')
        # Only yang Day Masters have a blade: Yi in Yin is the Rob Wealth's month.
        self.assertNotIn('乙', BLADE)
        named = name_structure(pillars('壬子 庚寅 乙丑 辛巳'))
        self.assertEqual((named['structure'], named['by']), ('jian_lu_yue_jie', 'main_qi'))

    def test_a_showing_middle_qi_takes_charge_unless_a_stem_keeps_the_main_qi(self) -> None:
        # 己生申月，本属伤官，藏庚透壬，则化为财 (章丞相).
        named = name_structure(pillars('甲子 壬申 己亥 辛未'))
        self.assertEqual((named['by'], named['stem']), ('middle_qi_shows', '壬'))
        # 乙生申月，透壬化印，而又透戊，则财能生官，印逢财而退位 (薛相公).
        named = name_structure(pillars('甲申 壬申 乙巳 戊寅'))
        self.assertEqual((named['by'], named['stem'], named['because']), ('main_qi_kept', '庚', '戊'))
        # The Day Master's own element showing does not take charge (马参政: Ren in Shen).
        named = name_structure(pillars('壬寅 戊申 壬辰 壬寅'))
        self.assertEqual((named['structure'], named['by']), ('resource', 'main_qi'))

    def test_a_mixed_month_is_named_by_the_element_that_shows(self) -> None:
        # 甲透未库: Jia shows the Wood stored in Wei, and names Wealth for Xin.
        named = name_structure(pillars('甲子 辛未 辛酉 壬辰'))
        self.assertEqual((named['structure'], named['by'], named['stem']), ('wealth', 'mixed_shows', '甲'))
        # 辰中暗煞，壬以透之: Ren names Seven Killings, though Wu (the Eating God) shows.
        named = name_structure(pillars('壬辰 甲辰 丙戌 戊戌'))
        self.assertEqual((named['structure'], named['stem']), ('seven_killings', '壬'))

    def test_a_three_way_combination_changes_the_month(self) -> None:
        # 丁生亥月，本为正官，支全卯未，则化为印 (金状元).
        self.assertEqual(full_combination('亥', ['卯', '亥', '未', '戌']), '亥卯未')
        named = name_structure(pillars('乙卯 丁亥 丁未 庚戌'))
        self.assertEqual(
            (named['structure'], named['by'], named['because']), ('resource', 'combination', '亥卯未')
        )
        # 丙生寅月，午戌会劫……则仍为印: a combination into the Day Master's own element
        # keeps the month's god.
        named = name_structure(pillars('庚午 庚寅 丙戌 己丑'))
        self.assertEqual((named['structure'], named['by']), ('resource', 'main_qi'))

    def test_ten_gods_of_the_day_master(self) -> None:
        self.assertEqual(ten_god('乙', '庚'), 'direct_officer')
        self.assertEqual(ten_god('乙', '辛'), 'seven_killings')
        self.assertEqual(ten_god('丙', '壬'), 'seven_killings')


if __name__ == '__main__':
    unittest.main()


from eight_characters.structure import (  # noqa: E402
    LUCK_CASES,
    Facts,
    Verdict,
    luck_reading,
)
from eight_characters.ten_gods import TEN_GOD_NAMES, TenGodName  # noqa: E402

G: Final[dict[str, TenGodName]] = {
    'friend': 'friend',
    'rob': 'rob_wealth',
    'eating': 'eating_god',
    'hurting': 'hurting_officer',
    'iwealth': 'indirect_wealth',
    'dwealth': 'direct_wealth',
    'killings': 'seven_killings',
    'officer': 'direct_officer',
    'owl': 'indirect_resource',
    'resource': 'direct_resource',
}


def facts(day_master: str, shown: str, tally: dict[str, int] | None = None, branches: str = '子子子子') -> Facts:
    weights = dict.fromkeys(TEN_GOD_NAMES, 0)
    for short, value in (tally or {}).items():
        weights[G[short]] = value
    return Facts(
        day_master=day_master,
        shown=tuple(shown),
        shown_gods=tuple(ten_god(day_master, stem) for stem in shown),
        branches=tuple(branches),
        tally=weights,
    )


# For a Jia Day Master: 甲 Friend, 乙 Rob Wealth, 丙 Eating God, 丁 Hurting Officer,
# 戊 Indirect Wealth, 己 Direct Wealth, 庚 Seven Killings, 辛 Direct Officer, 壬
# Indirect Resource, 癸 Direct Resource. Weak: support under half the count.
WEAK: Final = {'friend': 100, 'iwealth': 300}
STRONG: Final = {'friend': 300, 'iwealth': 100}

# Each case: the structure, a chart's facts that meet it, the case, and verdicts the
# docs' tables give (gods not listed are idle unless the case names them).
CASES: Final[tuple[tuple[str, Facts, str, dict[str, Verdict]], ...]] = (
    # 论正官取运
    ('direct_officer', facts('甲', '乙庚辛'), 'killings_combined_by_rob',
     {'iwealth': 'favourable', 'eating': 'favourable', 'rob': 'favourable', 'resource': 'favourable',
      'killings': 'against', 'officer': 'against'}),
    ('direct_officer', facts('乙', '丙辛庚'), 'killings_combined_by_hurting_officer',
     {'hurting': 'favourable', 'dwealth': 'favourable', 'owl': 'against', 'officer': 'against'}),
    ('direct_officer', facts('甲', '庚辛壬'), 'killings', {'eating': 'idle', 'killings': 'against'}),
    ('direct_officer', facts('甲', '丙辛壬'), 'output_and_resource',
     {'officer': 'favourable', 'owl': 'favourable', 'iwealth': 'strongly_against'}),
    ('direct_officer', facts('甲', '丙壬癸'), 'output_and_resource', {'dwealth': 'idle'}),
    ('direct_officer', facts('甲', '戊辛壬', WEAK), 'wealth_and_resource', {'friend': 'favourable'}),
    ('direct_officer', facts('甲', '戊辛壬', STRONG), 'wealth_and_resource', {'officer': 'favourable'}),
    ('direct_officer', facts('甲', '戊辛', WEAK), 'wealth',
     {'resource': 'favourable', 'rob': 'favourable', 'hurting': 'strongly_against', 'iwealth': 'idle'}),
    ('direct_officer', facts('甲', '戊辛', {'friend': 300, 'iwealth': 100, 'officer': 50}), 'wealth',
     {'iwealth': 'favourable', 'officer': 'favourable'}),
    ('direct_officer', facts('甲', '辛壬', {'friend': 100, 'officer': 300}), 'resource',
     {'friend': 'favourable', 'dwealth': 'idle', 'eating': 'favourable'}),
    ('direct_officer', facts('甲', '辛壬', STRONG), 'resource', {'dwealth': 'favourable'}),
    ('direct_officer', facts('甲', '辛'), 'general',
     {'iwealth': 'favourable', 'owl': 'favourable', 'hurting': 'against', 'killings': 'against'}),
    # 论财取运
    ('wealth', facts('甲', '庚壬'), 'killings_and_resource',
     {'owl': 'most', 'dwealth': 'strongly_against', 'eating': 'idle'}),
    ('wealth', facts('甲', '庚'), 'killings', {'hurting': 'favourable', 'rob': 'favourable'}),
    ('wealth', facts('甲', '辛'), 'officer',
     {'friend': 'favourable', 'owl': 'favourable', 'killings': 'against', 'hurting': 'against'}),
    ('wealth', facts('甲', '辛丙壬'), 'officer', {'killings': 'favourable', 'hurting': 'idle'}),
    ('wealth', facts('甲', '丁'), 'hurting_officer',
     {'iwealth': 'favourable', 'killings': 'against', 'officer': 'against', 'resource': 'against'}),
    ('wealth', facts('甲', '丙壬', WEAK), 'eating_god_and_resource',
     {'friend': 'favourable', 'owl': 'favourable', 'officer': 'against', 'killings': 'idle'}),
    ('wealth', facts('甲', '丙壬', STRONG), 'eating_god_and_resource',
     {'iwealth': 'favourable', 'eating': 'favourable'}),
    ('wealth', facts('甲', '丙', WEAK), 'eating_god',
     {'friend': 'favourable', 'killings': 'idle', 'officer': 'against', 'owl': 'against'}),
    ('wealth', facts('甲', '丙', STRONG), 'eating_god', {'dwealth': 'favourable', 'eating': 'favourable'}),
    ('wealth', facts('甲', '壬', WEAK), 'resource', {'officer': 'favourable', 'resource': 'most'}),
    ('wealth', facts('甲', ''), 'general',
     {'eating': 'favourable', 'officer': 'favourable', 'friend': 'against', 'rob': 'against',
      'killings': 'against', 'hurting': 'idle'}),
    # 论印绶取运
    ('resource', facts('甲', '庚辛'), 'officer_and_killings',
     {'eating': 'favourable', 'owl': 'favourable', 'friend': 'favourable',
      'officer': 'strongly_against', 'killings': 'strongly_against', 'dwealth': 'strongly_against'}),
    ('resource', facts('甲', '庚丙'), 'killings_and_output',
     {'rob': 'favourable', 'resource': 'favourable', 'hurting': 'favourable',
      'officer': 'against', 'iwealth': 'against'}),
    ('resource', facts('甲', '庚'), 'killings',
     {'eating': 'favourable', 'friend': 'favourable', 'dwealth': 'strongly_against'}),
    ('resource', facts('甲', '辛丁'), 'officer_and_output',
     {'officer': 'favourable', 'owl': 'favourable', 'eating': 'against', 'killings': 'idle'}),
    ('resource', facts('甲', '戊'), 'wealth',
     {'rob': 'favourable', 'friend': 'idle', 'officer': 'favourable', 'resource': 'favourable',
      'iwealth': 'strongly_against'}),
    ('resource', facts('甲', '丙', {'resource': 300, 'eating': 100}), 'output',
     {'dwealth': 'favourable', 'hurting': 'favourable', 'officer': 'strongly_against',
      'killings': 'favourable'}),
    ('resource', facts('甲', '丙', {'resource': 100, 'eating': 300}), 'output', {'dwealth': 'against'}),
    ('resource', facts('甲', '辛', {'resource': 300, 'officer': 100}), 'officer_resource_heavy',
     {'iwealth': 'favourable', 'eating': 'most'}),
    ('resource', facts('甲', '辛', {'resource': 100, 'officer': 300}), 'general',
     {'officer': 'favourable', 'killings': 'favourable', 'rob': 'favourable', 'dwealth': 'against'}),
    # 论食神取运
    ('eating_god', facts('甲', '庚壬'), 'killings_and_resource',
     {'owl': 'favourable', 'friend': 'favourable', 'hurting': 'favourable', 'officer': 'favourable',
      'killings': 'favourable', 'iwealth': 'strongly_against'}),
    ('eating_god', facts('甲', '庚', {'killings': 300, 'eating': 100}), 'killings',
     {'resource': 'favourable', 'rob': 'favourable', 'iwealth': 'strongly_against'}),
    ('eating_god', facts('甲', '庚', {'killings': 100, 'eating': 300}), 'killings',
     {'resource': 'most', 'iwealth': 'favourable'}),
    ('eating_god', facts('甲', '壬戊'), 'resource_and_wealth',
     {'dwealth': 'favourable', 'hurting': 'favourable', 'owl': 'strongly_against',
      'killings': 'strongly_against'}),
    ('eating_god', facts('甲', '壬', {'eating': 300, 'friend': 100}), 'resource_output_strong',
     {'iwealth': 'most', 'eating': 'favourable', 'resource': 'strongly_against', 'officer': 'against'}),
    ('eating_god', facts('甲', '壬', {'eating': 100, 'friend': 300}), 'general',
     {'owl': 'against', 'resource': 'idle', 'friend': 'favourable'}),
    ('eating_god', facts('甲', '戊', {'friend': 300, 'iwealth': 100}), 'wealth',
     {'iwealth': 'favourable', 'eating': 'favourable', 'killings': 'against'}),
    ('eating_god', facts('甲', '戊', {'friend': 100, 'iwealth': 300}), 'wealth', {'rob': 'favourable'}),
    # 论偏官取运
    ('seven_killings', facts('甲', '辛', {'friend': 100, 'iwealth': 300, 'killings': 50}), 'officer',
     {'friend': 'favourable', 'eating': 'favourable'}),
    ('seven_killings', facts('甲', '戊壬丙'), 'wealth_clears_resource',
     {'rob': 'against', 'hurting': 'favourable', 'dwealth': 'favourable', 'owl': 'against',
      'killings': 'favourable'}),
    ('seven_killings', facts('甲', '丙', {'killings': 300, 'eating': 100}), 'eating_god',
     {'eating': 'favourable', 'officer': 'strongly_against', 'resource': 'against'}),
    ('seven_killings', facts('甲', '丙', {'killings': 100, 'eating': 300}), 'eating_god',
     {'killings': 'favourable'}),
    ('seven_killings', facts('甲', '丙', {'killings': 100, 'eating': 100, 'iwealth': 300}), 'eating_god',
     {'friend': 'favourable'}),
    ('seven_killings', facts('甲', '壬'), 'resource',
     {'iwealth': 'against', 'hurting': 'favourable', 'eating': 'idle', 'owl': 'favourable',
      'friend': 'favourable'}),
    ('seven_killings', facts('甲', '戊', {'friend': 300, 'iwealth': 400, 'killings': 100}),
     'wealth_helps_killings', {'eating': 'favourable', 'owl': 'favourable', 'rob': 'favourable'}),
    ('seven_killings', facts('甲', '戊', {'friend': 300, 'iwealth': 50, 'killings': 100}),
     'wealth_helps_killings', {'dwealth': 'favourable', 'killings': 'favourable'}),
    ('seven_killings', facts('甲', '乙', {'rob': 300, 'killings': 100}), 'rob_wealth_against_killings',
     {'killings': 'favourable', 'resource': 'idle', 'officer': 'against'}),
    ('seven_killings', facts('甲', '乙', {'rob': 100, 'killings': 300}), 'rob_wealth_against_killings',
     {'eating': 'favourable', 'hurting': 'favourable'}),
    ('seven_killings', facts('甲', ''), 'general',
     {'eating': 'favourable', 'hurting': 'idle', 'iwealth': 'strongly_against',
      'owl': 'strongly_against'}),
    # 论伤官取运
    ('hurting_officer', facts('甲', '庚壬'), 'killings_and_resource',
     {'owl': 'most', 'eating': 'favourable', 'officer': 'against', 'dwealth': 'strongly_against'}),
    ('hurting_officer', facts('甲', '庚', branches='申子子子'), 'killings',
     {'eating': 'favourable', 'owl': 'favourable', 'rob': 'favourable', 'dwealth': 'strongly_against'}),
    ('hurting_officer', facts('甲', '庚', {'hurting': 300, 'killings': 100}), 'killings',
     {'owl': 'favourable', 'dwealth': 'favourable', 'eating': 'idle'}),
    ('hurting_officer', facts('甲', '庚', {'hurting': 100, 'killings': 300}), 'killings',
     {'owl': 'favourable', 'dwealth': 'strongly_against'}),
    ('hurting_officer', facts('甲', '戊壬', {'iwealth': 300, 'owl': 100}), 'wealth_and_resource',
     {'resource': 'favourable', 'iwealth': 'idle'}),
    ('hurting_officer', facts('甲', '戊壬', {'iwealth': 100, 'owl': 300}), 'wealth_and_resource',
     {'dwealth': 'favourable', 'owl': 'idle'}),
    ('hurting_officer', facts('甲', '壬'), 'resource',
     {'officer': 'favourable', 'killings': 'favourable', 'owl': 'favourable', 'eating': 'idle',
      'iwealth': 'strongly_against'}),
    ('hurting_officer', facts('甲', '戊', WEAK), 'wealth', {'resource': 'favourable', 'friend': 'favourable'}),
    ('hurting_officer', facts('甲', '戊', STRONG), 'wealth',
     {'dwealth': 'favourable', 'hurting': 'favourable', 'eating': 'idle'}),
    ('hurting_officer', facts('庚', '丁'), 'officer_metal',
     {'iwealth': 'favourable', 'resource': 'favourable', 'eating': 'against'}),
    ('hurting_officer', facts('甲', '辛'), 'general',
     {'officer': 'against', 'owl': 'favourable', 'iwealth': 'favourable'}),
    # 论阳刃取运
    ('yang_blade', facts('甲', '庚辛'), 'officer_and_killings',
     {'eating': 'favourable', 'friend': 'favourable', 'iwealth': 'against', 'officer': 'against',
      'killings': 'idle'}),
    ('yang_blade', facts('甲', '庚', {'friend': 100, 'killings': 300}), 'killings',
     {'rob': 'favourable', 'owl': 'favourable', 'eating': 'idle', 'killings': 'idle'}),
    ('yang_blade', facts('甲', '庚', {'friend': 300, 'killings': 100}), 'killings', {'killings': 'favourable'}),
    ('yang_blade', facts('甲', '辛', branches='酉子子子'), 'officer',
     {'officer': 'favourable', 'owl': 'favourable', 'rob': 'favourable', 'hurting': 'against'}),
    ('yang_blade', facts('甲', '辛'), 'officer', {'officer': 'favourable', 'owl': 'idle'}),
    ('yang_blade', facts('甲', '戊'), 'general', {'officer': 'favourable', 'killings': 'favourable'}),
    # 论建禄月劫取运
    ('jian_lu_yue_jie', facts('甲', '庚辛'), 'officer_and_killings',
     {'eating': 'favourable', 'friend': 'favourable', 'rob': 'idle', 'owl': 'against',
      'iwealth': 'against', 'officer': 'against'}),
    ('jian_lu_yue_jie', facts('甲', '乙庚戊'), 'killings_combined_wealth_kept',
     {'hurting': 'favourable', 'iwealth': 'idle', 'officer': 'idle', 'rob': 'favourable'}),
    ('jian_lu_yue_jie', facts('甲', '庚甲己', {'eating': 300, 'killings': 100}),
     'wealth_combined_killings_kept', {'killings': 'favourable'}),
    ('jian_lu_yue_jie', facts('甲', '庚丙', {'eating': 100, 'killings': 300}), 'killings_and_eating_god',
     {'eating': 'favourable'}),
    ('jian_lu_yue_jie', facts('甲', '辛壬'), 'officer_and_resource',
     {'iwealth': 'favourable', 'killings': 'against', 'eating': 'idle', 'friend': 'idle'}),
    ('jian_lu_yue_jie', facts('甲', '辛戊'), 'officer_and_wealth',
     {'owl': 'favourable', 'officer': 'favourable', 'hurting': 'against', 'dwealth': 'favourable',
      'killings': 'against'}),
    ('jian_lu_yue_jie', facts('甲', '戊丙', {'iwealth': 300, 'eating': 100, 'friend': 100}),
     'wealth_and_output', {'resource': 'favourable', 'friend': 'idle', 'killings': 'idle', 'officer': 'against'}),
    ('jian_lu_yue_jie', facts('甲', '戊丙', {'iwealth': 100, 'eating': 100, 'friend': 300}),
     'wealth_and_output', {'iwealth': 'favourable', 'owl': 'against', 'rob': 'against'}),
    ('jian_lu_yue_jie', facts('甲', '丙', {'eating': 100, 'friend': 300}), 'output',
     {'dwealth': 'most', 'killings': 'idle', 'resource': 'against', 'officer': 'against'}),
    ('jian_lu_yue_jie', facts('甲', '丙', {'eating': 300, 'friend': 100}), 'output',
     {'dwealth': 'favourable', 'resource': 'idle'}),
    ('jian_lu_yue_jie', facts('甲', '辛'), 'general',
     {'officer': 'favourable', 'iwealth': 'favourable', 'eating': 'favourable', 'hurting': 'idle'}),
)


class TestLuckCases(unittest.TestCase):
    def test_each_case_of_each_chapter(self) -> None:
        for structure, chart, case_id, expected in CASES:
            with self.subTest(structure=structure, case=case_id, shown=chart.shown):
                case, _, verdicts, _ = luck_reading(structure, chart)  # type: ignore[arg-type]
                self.assertEqual(case.id, case_id)
                for short, verdict in expected.items():
                    self.assertEqual(verdicts[G[short]], verdict, short)

    def test_every_case_is_tested(self) -> None:
        tested = {(structure, case) for structure, _, case, _ in CASES}
        for structure, cases in LUCK_CASES.items():
            for case in cases:
                with self.subTest(structure=structure, case=case.id):
                    self.assertIn((structure, case.id), tested)
            self.assertIn((structure, 'general'), tested)


from eight_characters.schools import SEASON_OF_MONTH, standings  # noqa: E402
from eight_characters.structure import read_structure  # noqa: E402


def read(chart: str) -> dict[str, object]:
    natal = pillars(chart)
    # The month's own season stands in for the birth's: these tests turn on what shows.
    return dict(read_structure(natal, standings(SEASON_OF_MONTH[natal['month'][1]])))


class TestOuterStructures(unittest.TestCase):
    """论杂格's charts. The school reads none of these five: their month has no use,
    or the Day Master is transformed."""

    def test_outer_structures_are_not_read(self) -> None:
        for who, chart, reason in (
            ('吴相公, 曲直: a Lu month with nothing used shown or joined', '癸亥 乙卯 乙未 壬午', 'month_without_use'),
            ('倒冲: a Blade month with nothing used', '戊午 戊午 戊午 戊午', 'month_without_use'),
            ('郭统制, 井拦', '戊子 庚申 庚申 庚申', 'month_without_use'),
            ('章统制, 遥合', '辛丑 辛丑 辛丑 庚寅', 'month_without_use'),
            ('从化: 丁壬化木 in a 卯 month with 寅卯辰', '甲戌 丁卯 壬寅 甲辰', 'transformation'),
        ):
            with self.subTest(who=who):
                reading = read(chart)
                self.assertEqual(reading['outer'], reason)
                self.assertIsNone(reading['verdicts'])

    def test_a_shown_use_is_read_by_the_month(self) -> None:
        # 论外格用舍: 若月令自有用神，岂可另寻外格？……干头有财，何用冲财. 论杂格 also
        # lists these as outer, though a god the month can use shows in a stem; the
        # school follows the first rule and reads them by their month.
        for who, chart, structure in (
            ('冲子官, with 庚 Wealth shown', '甲寅 庚午 丙午 甲午', 'yang_blade'),
            ('蜀王, 合禄, with 庚 Eating God shown', '己未 戊辰 戊辰 庚申', 'jian_lu_yue_jie'),
            ('起丞相, 合禄, with 己 Killings shown', '己酉 癸未 癸未 庚申', 'seven_killings'),
            ('十二节度使, 刑合, with 乙 Eating God shown', '乙未 癸卯 癸卯 甲寅', 'eating_god'),
        ):
            with self.subTest(who=who):
                reading = read(chart)
                self.assertIsNone(reading['outer'])
                self.assertEqual(reading['naming']['structure'], structure)  # type: ignore[index]

    def test_a_chart_with_no_support_beyond_its_day_master_follows(self) -> None:
        # No Companion or Resource anywhere but the Day Master's own stem.
        reading = read('庚午 庚戌 甲午 庚午')
        self.assertEqual(reading['outer'], 'following')

    def test_the_texts_lu_month_chart_reads_its_case(self) -> None:
        # 有用官而印护者，如庚戌、戊子、癸酉、癸亥，金丞相命是也.
        reading = read('庚戌 戊子 癸酉 癸亥')
        self.assertEqual((reading['chapter'], reading['case']), ('论建禄月劫取运', 'officer_and_resource'))
