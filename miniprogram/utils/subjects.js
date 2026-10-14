// utils/subjects.js
// 考研分科进度:科目 -> 章节 -> 复习轮次(0未开始/1一轮/2强化/3冲刺)
// 数据存于后端 progress_archive.subjectProgress(JSON 字符串),结构:
// { politics: { name, chapters: [{ name, round }] }, english: {...}, math: {...}, major: {...} }

var ROUND_MAX = 3;
var PUBLIC_KEYS = ['politics', 'english', 'math'];

var ROUNDS = [
  { v: 0, label: '未开始' },
  { v: 1, label: '一轮' },
  { v: 2, label: '强化' },
  { v: 3, label: '冲刺' },
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

/**
 * 用默认结构合并已存数据(向后兼容:旧数据缺科目/章节时补全,已有轮次按章节名保留)
 * 返回完整对象,可直接提交与渲染
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
      return { name: name, round: round };
    });
    // 已存但默认里没有的自定义章节也保留
    oldChapters.forEach(function (ch) {
      if (!ch || !ch.name) return;
      var exists = false;
      for (var j = 0; j < chapters.length; j++) {
        if (chapters[j].name === ch.name) { exists = true; break; }
      }
      if (!exists) chapters.push({ name: ch.name, round: Math.max(0, Math.min(ROUND_MAX, Number(ch.round) || 0)) });
    });
    out[def.key] = { name: def.name, chapters: chapters };
  });
  return out;
}

/** 聚合成视图:每科百分比、各轮次计数、扁平化章节(带轮次文案),供 WXML 渲染 */
function buildView(sp) {
  var data = normalize(sp);
  return DEFAULT_SUBJECTS.map(function (def) {
    var subj = data[def.key];
    var counts = [0, 0, 0, 0];
    var weight = 0;
    var chapters = subj.chapters.map(function (ch) {
      counts[ch.round] += 1;
      weight += ch.round;
      return { name: ch.name, round: ch.round, roundLabel: roundLabel(ch.round) };
    });
    var total = chapters.length;
    var percent = total === 0 ? 0 : Math.round((weight / (ROUND_MAX * total)) * 100);
    return { key: def.key, name: subj.name, percent: percent, total: total, counts: counts, chapters: chapters };
  });
}

/** 点击章节:轮次 0->1->2->3->0 循环,返回新对象(避免直接改入参) */
function cycle(sp, key, idx) {
  var data = normalize(sp);
  var subj = data[key];
  if (!subj || !subj.chapters[idx]) return data;
  subj.chapters[idx].round = (subj.chapters[idx].round + 1) % (ROUND_MAX + 1);
  return data;
}

/** 公共课/专业课整体百分比(与后端口径一致) */
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

module.exports = {
  ROUNDS: ROUNDS,
  DEFAULT_SUBJECTS: DEFAULT_SUBJECTS,
  roundLabel: roundLabel,
  normalize: normalize,
  buildView: buildView,
  cycle: cycle,
  overall: overall,
};
