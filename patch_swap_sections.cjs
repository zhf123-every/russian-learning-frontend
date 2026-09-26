const fs = require('fs');
const p = 'C:/Users/张宏飞/Desktop/website_source/russian-learning-frontend-main/src/pages/GameStore.jsx';
let c = fs.readFileSync(p, 'utf8');

const videoStart = '{/* ===== 通关视频 ===== */}';
const videoEnd = '{/* ===== 通关秘籍 ===== */}';
const i1 = c.indexOf(videoStart);
const i2 = c.indexOf(videoEnd);
if (i1 < 0 || i2 < 0) { console.log('FATAL markers', i1, i2); process.exit(1); }
if (i1 > i2) { console.log('ALREADY SWAPPED, skip'); process.exit(0); }

const videoBlock = c.slice(i1, i2);

// 课程块结尾：i2 之后第一个 "</section>"，再往后到 ")}" 和 "</>"（容忍 \r\n）
let t1 = c.indexOf('</section>', i2);
if (t1 < 0) { console.log('FATAL section close'); process.exit(1); }
const afterClose = c.slice(t1);
const closeIdx = afterClose.indexOf('</section>'); // 课程 section 的闭合（第一个 </section>）
// 课程 section 收尾：</section>\r\n        )}\r\n        </>
const tailLen = afterClose.indexOf(')}', closeIdx + 10);
const fragEnd = afterClose.indexOf('</>', tailLen + 3);
if (tailLen < 0 || fragEnd < 0) { console.log('FATAL tail markers', tailLen, fragEnd); process.exit(1); }
const guideBlock = c.slice(i2, t1 + '</section>'.length + 0);
const guideBlockFull = c.slice(i2, t1 + fragEnd + 4); // 含 </section> )} </>
const guideBlockCore = c.slice(i2, t1 + fragEnd + 4);

const rest = c.slice(t1 + fragEnd + 4);
const out = c.slice(0, i1) + guideBlockCore + '\n' + videoBlock + rest;
fs.writeFileSync(p, out, 'utf8');
console.log('SWAP DONE', 'video:', videoBlock.length, 'guide:', guideBlockCore.length);
