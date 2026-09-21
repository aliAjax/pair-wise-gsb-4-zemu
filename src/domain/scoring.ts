// 领域数据：离线机器打分（无外部语音服务时的确定性模拟）。
// 分数由“句子 + 版本 + 日期 + 当日序号 + 录音条数”哈希决定，同一轮录音预览与入库分数一致，刷新后规则可复现。

const TAG_POOL = [
  '长元音偏短',
  'θ/ð 咬舌不到位',
  '词重音错位',
  '连读失拍',
  '尾音吞音',
  '句调偏平',
  'r 卷舌过度',
];

function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export interface MachineScore {
  score: number;
  wrongTags: string[];
}

export function machineScore(seedParts: Array<string | number>): MachineScore {
  const seed = seedParts.join('|');
  const r = fnv1a(seed) / 4_294_967_296;
  const score = 66 + Math.floor(r * 34); // 66–99，保证 85 上下两侧都会出现
  const n = score < 70 ? 3 : score < 80 ? 2 : score < 85 ? 1 : 0;
  const wrongTags: string[] = [];
  let k = 0;
  while (wrongTags.length < n) {
    const tag = TAG_POOL[fnv1a(`${seed}::${k}`) % TAG_POOL.length];
    if (!wrongTags.includes(tag)) wrongTags.push(tag);
    k += 1;
  }
  return { score, wrongTags };
}
