// utils/subjects.js
// 考研分科进度:科目 -> 章节 -> 轮次(0-3) -> 轮次内细分(subStage 0-4)
// round: 0未开始 / 1一轮 / 2强化 / 3冲刺
// subStage: 0未开始 / 1看教材 / 2做笔记 / 3做习题 / 4回顾
// 数据存于后端 progress_archive.subjectProgress(JSON 字符串)

var ROUND_MAX = 3;
var PUBLIC_KEYS = ['politics', 'english', 'math'];

var ROUNDS = [
  { v: 0, label: '未开始' },
  { v: 1, label: '一轮' },
  { v: 2, label: '强化' },
  { v: 3, label: '冲刺' },
];

var SUB_STAGES = [
  { v: 0, label: '未开始', short: '-' },
  { v: 1, label: '看教材', short: '教' },
  { v: 2, label: '做笔记', short: '笔' },
  { v: 3, label: '做习题', short: '题' },
  { v: 4, label: '回顾', short: '顾' },
];

// 经管类考研默认科目与章节(数学三;专业课为通用章节)
var DEFAULT_SUBJECTS = [
  {
    key: 'politics',
    name: '政治',
    chapters: [
      '马克思主义基本原理',
      '毛泽东思想和中国特色社会主义理论体系概论',
      '中国近现代史纲要',
      '思想道德与法治',
      '形势与政策及当代世界经济与政治',
    ],
  },
  {
    key: 'english',
    name: '英语',
    chapters: [
      '词汇',
      '语法与长难句',
      '阅读理解',
      '翻译',
      '写作',
      '完形填空与新题型',
    ],
  },
  {
    key: 'math',
    name: '数学三',
    chapters: [
      '高等数学',
      '线性代数',
      '概率论与数理统计',
    ],
  },
  {
    key: 'major',
    name: '专业课',
    chapters: [
      '参考教材通读',
      '专业课笔记整理',
      '历年真题训练',
      '重点内容背诵',
      '模拟卷演练',
    ],
  },
];

function roundLabel(v) {
  var r = ROUNDS[v];
  return r ? r.label : '未开始';
}

function subStageLabel(v) {
  var s = SUB_STAGES[v];
  return s ? s.label : '未开始';
}

function subStageShort(v) {
  var s = SUB_STAGES[v];
  return s ? s.short : '-';
}

/**
 * 用默认结构合并已存数据(向后兼容:旧数据缺科目/章节时补全,已有轮次按章节名保留)
 */
function normalize(sp) {
  var out = {};
  var stored = sp || {};
  DEFAULT_SUBJECTS.forEach(function (def) {
    var old = stored[def.key] || {};
    var oldChapters = old.chapters || [];
    var chapters = def.chapters.map(function (name) {
      var hit = null;
      for (var i = 0; i < oldChapters.length; i++) {
        if (oldChapters[i] && oldChapters[i].name === name) { hit = oldChapters[i]; break; }
      }
      var round = hit ? Math.max(0, Math.min(ROUND_MAX, Number(hit.round) || 0)) : 0;
      var subStage = hit ? Math.max(0, Math.min(4, Number(hit.subStage) || 0)) : 0;
      // 兼容旧数据:有 round 但无 subStage 时,根据 round 推断初始 subStage
      if (round > 0 && subStage === 0 && hit && hit.round != null) {
        subStage = 1; // 看教材
      }
      return {
        name: name,
        round: round,
        subStage: subStage,
        weak: !!(hit && hit.weak),
      };
    });
    // 已存但默认里没有的自定义章节也保留
    oldChapters.forEach(function (ch) {
      if (!ch || !ch.name) return;
      var exists = false;
      for (var j = 0; j < chapters.length; j++) {
        if (chapters[j].name === ch.name) { exists = true; break; }
      }
      if (!exists) {
        chapters.push({
          name: ch.name,
          round: Math.max(0, Math.min(ROUND_MAX, Number(ch.round) || 0)),
          subStage: Math.max(0, Math.min(4, Number(ch.subStage) || 0)),
          weak: !!ch.weak,
        });
      }
    });
    out[def.key] = { name: def.name, chapters: chapters };
  });
  return out;
}

/**
 * 章节完成度(0-100),基于 round + subStage 加权
 * round 0 → 0%; round 1→25%; round 2→50%; round 3→75%
 * subStage 在每个 round 内再分 0-25% 区间
 */
function chapterPercent(ch) {
  var base = ch.round * 25;
  var inner = ch.subStage * 5; // subStage 0-4,每档 5%
  return Math.min(100, base + inner);
}

/** 聚合成视图 */
function buildView(sp) {
  var data = normalize(sp);
  return DEFAULT_SUBJECTS.map(function (def) {
    var subj = data[def.key];
    var counts = [0, 0, 0, 0];
    var weakCount = 0;
    var totalPercent = 0;
    var chapters = subj.chapters.map(function (ch) {
      counts[ch.round] += 1;
      totalPercent += chapterPercent(ch);
      if (ch.weak) weakCount += 1;
      return {
        name: ch.name,
        round: ch.round,
        roundLabel: roundLabel(ch.round),
        subStage: ch.subStage,
        subStageLabel: subStageLabel(ch.subStage),
        subStageShort: subStageShort(ch.subStage),
        weak: !!ch.weak,
        chapterPercent: chapterPercent(ch),
      };
    });
    var total = chapters.length;
    var percent = total === 0 ? 0 : Math.round(totalPercent / total);
    return {
      key: def.key,
      name: subj.name,
      percent: percent,
      total: total,
      counts: counts,
      weakCount: weakCount,
      chapters: chapters,
    };
  });
}

/** 点击章节轮次: 0→1→2→3→0 */
function cycleRound(sp, key, idx) {
  var data = normalize(sp);
  var subj = data[key];
  if (!subj || !subj.chapters[idx]) return data;
  subj.chapters[idx].round = (subj.chapters[idx].round + 1) % (ROUND_MAX + 1);
  // round 提升时,subStage 重置为 1(看教材);round 为 0 时 subStage 为 0
  if (subj.chapters[idx].round === 0) {
    subj.chapters[idx].subStage = 0;
  } else {
    subj.chapters[idx].subStage = 1;
  }
  return data;
}

/** 点击章节细分: 0→1→2→3→4→0 */
function cycleSubStage(sp, key, idx) {
  var data = normalize(sp);
  var subj = data[key];
  if (!subj || !subj.chapters[idx]) return data;
  subj.chapters[idx].subStage = (subj.chapters[idx].subStage + 1) % 5;
  return data;
}

/** 切换薄弱标记 */
function toggleWeak(sp, key, idx) {
  var data = normalize(sp);
  var subj = data[key];
  if (!subj || !subj.chapters[idx]) return data;
  subj.chapters[idx].weak = !subj.chapters[idx].weak;
  return data;
}

/** 公共课/专业课整体百分比 */
function overall(sp) {
  var view = buildView(sp);
  var map = {};
  view.forEach(function (v) { map[v.key] = v.percent; });
  var pubTotal = 0;
  var pubN = 0;
  PUBLIC_KEYS.forEach(function (k) {
    if (map[k] !== undefined) { pubTotal += map[k]; pubN += 1; }
  });
  return {
    public: pubN === 0 ? 0 : Math.round(pubTotal / pubN),
    major: map.major || 0,
  };
}

/**
 * 从打卡历史推算每科进度趋势(最近 N 周)
 * history: [{ weekStart, progressPublic, progressMajor, ... }]
 * 返回: { public: [{week,value}], major: [{week,value}], subjects: { politics:[], english:[], math:[], major:[] } }
 */
function buildTrend(history, subjectProgress) {
  var weeks = (history || []).slice(-8); // 最多最近8周
  var result = {
    public: [],
    major: [],
    subjects: { politics: [], english: [], math: [], major: [] },
  };

  weeks.forEach(function (h) {
    if (h.progressPublic != null) {
      result.public.push({ week: h.weekStartText || h.weekStart, value: Number(h.progressPublic) });
    }
    if (h.progressMajor != null) {
      result.major.push({ week: h.weekStartText || h.weekStart, value: Number(h.progressMajor) });
    }
  });

  // 从最新 subjectProgress 算当前各科百分比,放到 subjects 里(历史打卡不存分科百分比)
  if (subjectProgress) {
    var view = buildView(subjectProgress);
    view.forEach(function (v) {
      result.subjects[v.key].push({ week: '当前', value: v.percent });
    });
  }
  return result;
}

module.exports = {
  ROUNDS: ROUNDS,
  SUB_STAGES: SUB_STAGES,
  DEFAULT_SUBJECTS: DEFAULT_SUBJECTS,
  roundLabel: roundLabel,
  subStageLabel: subStageLabel,
  subStageShort: subStageShort,
  normalize: normalize,
  buildView: buildView,
  cycleRound: cycleRound,
  cycleSubStage: cycleSubStage,
  toggleWeak: toggleWeak,
  overall: overall,
  buildTrend: buildTrend,
};
