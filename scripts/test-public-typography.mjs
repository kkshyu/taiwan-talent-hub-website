import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');
const EXTENSIONS = new Set(['.css', '.html', '.js']);
const NUMBER = String.raw`[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?`;
const FIXED_SIZE = new RegExp(`^(${NUMBER})\\s*(rem|em|px|pt|pc|in|cm|mm|q|%)$`, 'i');
const PX_PER_UNIT = { px: 1, pt: 96 / 72, pc: 16, in: 96, cm: 96 / 2.54, mm: 96 / 25.4, q: 96 / (2.54 * 40) };
const RELATIVE_FLOORS = { rem: 1, em: 1, '%': 100 };
const GLOBAL_KEYWORDS = new Set(['inherit', 'initial', 'unset']);
const SAFE_SIZE_KEYWORDS = new Set([
  ...GLOBAL_KEYWORDS,
  'medium', 'large', 'x-large', 'xx-large', 'xxx-large',
]);
const EXCLUDED = new Set([
  'public/access-mock.html',
  'public/admin.html',
  'public/ig-studio-lib.js',
  'public/ig-studio.js',
  'public/social-ads-lib.js',
  'public/vendor/html-to-image.js',
  'public/vendor/qrcode.min.js',
]);

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(file) : [file];
  });
}

function withoutAllowedDecoration(relative, source) {
  if (relative !== 'public/fellow/founding.css') return source;
  const masked = new Set();
  return source.replace(/([^{}]+)\{([^{}]*)\}/gs, (rule, selector, body) => {
    if (selector.trim().replace(/\s+/g, ' ') !== '.fnd-roster i') return rule;
    const safeBody = body.replace(
      /font-size\s*:\s*(\.52rem|\.42rem)(?=\s*(?:;|$))/gi,
      (declaration, size) => {
        const key = size.toLowerCase();
        if (masked.has(key)) return declaration;
        masked.add(key);
        return declaration.replace(/[^\n]/g, ' ');
      },
    );
    return `${selector}{${safeBody}}`;
  });
}

function withoutComments(relative, source) {
  const extension = path.extname(relative);
  const blank = (comment) => comment.replace(/[^\n]/g, ' ');
  if (extension === '.html') return source.replace(/<!--[\s\S]*?(?:-->|$)/g, blank);

  const masksLineComments = extension === '.js';
  const masked = source.split('');
  let quote = '';

  const mask = (start, end) => {
    for (let index = start; index < end; index += 1) {
      if (source[index] !== '\n') masked[index] = ' ';
    }
    return end - 1;
  };

  for (let index = 0; index < source.length; index += 1) {
    if (quote) {
      if (source[index] === '\\') index += 1;
      else if (source[index] === quote) quote = '';
      continue;
    }
    if (source.startsWith('/*', index)) {
      const end = source.indexOf('*/', index + 2);
      index = mask(index, end === -1 ? source.length : end + 2);
    } else if (masksLineComments && source.startsWith('//', index)) {
      const end = source.indexOf('\n', index + 2);
      index = mask(index, end === -1 ? source.length : end);
    } else if (["'", '"', '`'].includes(source[index])) {
      quote = source[index];
    }
  }

  return masked.join('');
}

function topLevelArgs(value, name) {
  const prefix = `${name}(`;
  if (!value.toLowerCase().startsWith(prefix) || !value.endsWith(')')) return null;
  const source = value.slice(prefix.length, -1);
  const args = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === '(') depth += 1;
    else if (source[index] === ')') {
      if (depth === 0) return null;
      depth -= 1;
    } else if (source[index] === ',' && depth === 0) {
      args.push(source.slice(start, index).trim());
      start = index + 1;
    }
  }
  if (depth !== 0) return null;
  args.push(source.slice(start).trim());
  return args.every(Boolean) ? args : null;
}

function fixedAtOrAboveFloor(value, allowEm = true) {
  const fixed = value.match(FIXED_SIZE);
  if (!fixed) return null;
  const amount = Number(fixed[1]);
  const unit = fixed[2].toLowerCase();
  if (!allowEm && unit === 'em') return false;
  return PX_PER_UNIT[unit] ? amount * PX_PER_UNIT[unit] >= 16 : amount >= RELATIVE_FLOORS[unit];
}

function belowFloor(rawValue) {
  const value = rawValue.replace(/\s*!\s*important\s*$/i, '').trim();
  const max = topLevelArgs(value, 'max');
  if (max) return !max.some((argument) => fixedAtOrAboveFloor(argument, false) === true);

  const clamp = topLevelArgs(value, 'clamp');
  if (clamp) return belowFloor(clamp[0]);

  const fixed = fixedAtOrAboveFloor(value);
  if (fixed !== null) return !fixed;
  if (SAFE_SIZE_KEYWORDS.has(value.toLowerCase())) return false;
  return true;
}

function fontShorthandBelowFloor(rawValue) {
  const value = rawValue.trim();
  if (GLOBAL_KEYWORDS.has(value.toLowerCase())) return false;
  const size = value.match(new RegExp(
    `^(${NUMBER}\\s*(?:rem|em|px|pt|pc|in|cm|mm|q|%)|medium|large|x-large|xx-large|xxx-large)`
      + String.raw`(?=\s*(?:\/\s*\S+)?\s+\S)`,
    'i',
  ));
  return !size || belowFloor(size[1]);
}

function literalValue(rawValue) {
  const value = rawValue.trim();
  const quote = value[0];
  if (!['"', "'", '`'].includes(quote) || value.at(-1) !== quote) return null;
  const literal = value.slice(1, -1);
  return literal.includes('\\') || (quote === '`' && literal.includes('${')) ? null : literal;
}

function sourceViolations(relative, rawSource) {
  const source = withoutAllowedDecoration(relative, withoutComments(relative, rawSource));
  const violations = [];
  const add = (match, property, value) => {
    const line = source.slice(0, match.index).split('\n').length;
    violations.push(`${relative}:${line} ${property}:${value}`);
  };
  for (const match of source.matchAll(/font-size\s*:\s*([^;}"']+)/gi)) {
    if (belowFloor(match[1])) add(match, 'font-size', match[1].trim());
  }
  for (const match of source.matchAll(/\bfont\s*:\s*([^;}"']+)/gi)) {
    const value = match[1].replace(/\s*!\s*important\s*$/i, '').trim().toLowerCase();
    if (!GLOBAL_KEYWORDS.has(value)) add(match, 'font', match[1].trim());
  }
  for (const match of source.matchAll(/(?:\.fontSize|\[\s*(['"`])fontSize\1\s*\])\s*=\s*([^;\n]+)/g)) {
    const value = literalValue(match[2]);
    if (value === null || belowFloor(value)) add(match, 'fontSize', match[2].trim());
  }
  for (const match of source.matchAll(/(?:\bfontSize|(['"`])fontSize\1)\s*:\s*([^,}\n]+)/g)) {
    const value = literalValue(match[2]);
    if (value === null || belowFloor(value)) add(match, 'fontSize', match[2].trim());
  }
  for (const match of source.matchAll(/\.style\s*(?:\.\s*font|\[\s*(['"`])font\1\s*\])\s*=\s*([^;\n]+)/g)) {
    const value = literalValue(match[2]);
    if (value === null || fontShorthandBelowFloor(value)) add(match, 'font', match[2].trim());
  }
  for (const match of source.matchAll(/\.setProperty\s*\(\s*(['"`])font-size\1\s*,/gi)) {
    const tail = source.slice(match.index + match[0].length);
    const call = tail.match(/^\s*('[^'\\]*'|"[^"\\]*"|`[^`\\]*`)\s*(?:,\s*(['"`])important\2\s*)?\)/i);
    const value = call ? literalValue(call[1]) : null;
    if (value === null || belowFloor(value)) add(match, 'font-size', call?.[1] ?? '<dynamic>');
  }
  return violations;
}

test('max 與 clamp 只接受頂層明確固定下限', () => {
  const unsafe = [
    'max(.5rem,.9rem)',
    'max(1vw,2vw)',
    'max(.5rem,calc(1rem - 1px))',
    'max(1em,.5rem)',
    'clamp(max(.2rem,.3rem),2vw,2rem)',
  ];
  const safe = [
    'max(1rem,.34em)',
    'max(.5rem,16px)',
    'max(.5rem,12pt)',
    'max(.5rem,100%)',
    'clamp(1rem,2vw,2rem)',
  ];

  assert.deepEqual(unsafe.map((value) => [value, belowFloor(value)]), unsafe.map((value) => [value, true]));
  assert.deepEqual(safe.map((value) => [value, belowFloor(value)]), safe.map((value) => [value, false]));
});

test('數值接受正負號與科學記號', () => {
  const unsafe = ['+.5rem', '1.5e1px', '9e1%', '-1e0rem', '+0', '-0'];
  const safe = ['+1rem', '1.6e1px', '1.2e1pt', '1e2%'];

  assert.deepEqual(unsafe.map((value) => [value, belowFloor(value)]), unsafe.map((value) => [value, true]));
  assert.deepEqual(safe.map((value) => [value, belowFloor(value)]), safe.map((value) => [value, false]));
});

test('viewport-only 字級涵蓋傳統、dynamic、small、large 與 logical 單位', () => {
  const units = [
    'vw', 'vh', 'vmin', 'vmax',
    'dvw', 'dvh', 'dvmin', 'dvmax',
    'svw', 'svh', 'svmin', 'svmax',
    'lvw', 'lvh', 'lvmin', 'lvmax',
    'vi', 'vb', 'dvi', 'dvb', 'svi', 'svb', 'lvi', 'lvb',
  ];

  assert.deepEqual(units.map((unit) => [unit, belowFloor(`1${unit}`)]), units.map((unit) => [unit, true]));
});

test('絕對單位以 96 CSS px/in 換算並接受空白 important', () => {
  const unsafe = ['.5rem ! important', '0.1in', '0.9pc', '0.4cm', '4mm', '15Q', '10Q'];
  const safe = ['16px', '12pt', '1pc', '1in', '2.54cm', '25.4mm', '40Q'];

  assert.deepEqual(unsafe.map((value) => [value, belowFloor(value)]), unsafe.map((value) => [value, true]));
  assert.deepEqual(safe.map((value) => [value, belowFloor(value)]), safe.map((value) => [value, false]));
});

test('未知與無固定下限的相對值一律 fail closed', () => {
  const unsafe = [
    '1ex', '1ch', '1cap', '1ic', '1lh', '1rlh',
    '1cqw', '1cqh', '1cqi', '1cqb', '1cqmin', '1cqmax',
    'var(--tiny)', 'mystery(1rem)', 'banana',
    'larger', 'revert', 'revert-layer',
    'clamp(var(--caption,.5rem),2vw,2rem)',
    'max(.5rem,var(--caption))',
  ];
  const safe = [
    'inherit', 'initial', 'unset',
    'medium', 'large', 'x-large', 'xx-large', 'xxx-large',
    'max(1rem,var(--caption))', 'max(1pc,var(--caption))',
  ];

  assert.deepEqual(unsafe.map((value) => [value, belowFloor(value)]), unsafe.map((value) => [value, true]));
  assert.deepEqual(safe.map((value) => [value, belowFloor(value)]), safe.map((value) => [value, false]));
});

test('scanner 攔截 font shorthand 與動態 fontSize 寫入', () => {
  const unsafe = [
    ['font shorthand', '.x{font:12px sans-serif}'],
    ['font-size revert', '.x{font-size:revert}'],
    ['font revert-layer', '.x{font:revert-layer}'],
    ['fontSize literal', "el.style.fontSize='12px';"],
    ['bare fontSize literal', 'el.fontSize="12px";'],
    ['fontSize dynamic', 'el.style.fontSize=size;'],
    ['setProperty literal', "el.style.setProperty('font-size','12px');"],
    ['multiline setProperty', `el.style.setProperty(
      'font-size',
      '12px'
    );`],
    ['setProperty dynamic', "el.style.setProperty('font-size',size);"],
    ['custom property', '.x{font-size:var(--tiny)}'],
  ];
  const safe = [
    ['font inherit', '.x{font:inherit}'],
    ['fontSize literal', "el.style.fontSize='1rem';"],
    ['setProperty literal', "el.style.setProperty('font-size','1rem');"],
    ['setProperty max literal', "el.style.setProperty('font-size','max(1rem,.5em)');"],
    ['multiline setProperty', `el.style.setProperty(
      'font-size',
      '1rem'
    );`],
    ['multiline setProperty important', `el.style.setProperty(
      'font-size',
      '1rem',
      'important'
    );`],
  ];

  assert.deepEqual(
    unsafe.map(([name, source]) => [name, sourceViolations('public/example.js', source).length > 0]),
    unsafe.map(([name]) => [name, true]),
  );
  assert.deepEqual(
    safe.map(([name, source]) => [name, sourceViolations('public/example.js', source).length > 0]),
    safe.map(([name]) => [name, false]),
  );
});

test('scanner 攔截四種常見 DOM style 寫法並接受各自的 16px 對照', () => {
  const unsafe = [
    "el.style.font='12px sans-serif';",
    "el.style['fontSize']='12px';",
    "Object.assign(el.style,{fontSize:'12px'});",
    "const style=el.style; style.setProperty('font-size','12px');",
  ];
  const safe = [
    "el.style.font='16px sans-serif';",
    "el.style['fontSize']='16px';",
    "Object.assign(el.style,{fontSize:'16px'});",
    "const style=el.style; style.setProperty('font-size','16px');",
  ];

  assert.deepEqual(
    unsafe.map((source) => sourceViolations('public/example.js', source).length),
    [1, 1, 1, 1],
  );
  assert.deepEqual(
    safe.map((source) => sourceViolations('public/example.js', source).length),
    [0, 0, 0, 0],
  );
});

test('scanner 同樣涵蓋 cssText 與 style attribute 字串', () => {
  const unsafe = [
    "el.style.cssText='font-size:12px';",
    "el.setAttribute('style','font-size:12px');",
  ];
  const safe = [
    "el.style.cssText='font-size:16px';",
    "el.setAttribute('style','font-size:16px');",
  ];

  assert.deepEqual(
    unsafe.map((source) => sourceViolations('public/example.js', source).length),
    [1, 1],
  );
  assert.deepEqual(
    safe.map((source) => sourceViolations('public/example.js', source).length),
    [0, 0],
  );
});

test('scanner 忽略 HTML 與 JS comments，但保留字串內斜線及真實 style 字串', () => {
  const comments = [
    ['public/example.js', "// el.style.fontSize='12px';"],
    ['public/example.js', "/* el.style.fontSize='12px'; */"],
    ['public/example.html', '<!-- <span style="font-size:12px">tiny</span> -->'],
  ];
  const live = [
    "const url='https://example.test/path'; el.style.fontSize='12px';",
    "const marker='//'; el.style.fontSize='12px';",
    "const css='font-size:12px';",
  ];

  assert.deepEqual(
    comments.map(([relative, source]) => sourceViolations(relative, source).length),
    [0, 0, 0],
  );
  assert.deepEqual(
    live.map((source) => sourceViolations('public/example.js', source).length),
    [1, 1, 1],
  );
});

test('HTML DATA 中的 URL 不得吞掉同行後續 style', () => {
  const source = '<p>https://example.test <span style="font-size:12px">tiny</span></p>';

  assert.equal(sourceViolations('public/example.html', source).length, 1);
});

test('HTML DATA apostrophe 不得妨礙後續 comment 遮罩', () => {
  const source = `<p>Don't</p>
<!-- <span style="font-size:12px">tiny</span> -->`;

  assert.equal(sourceViolations('public/example.html', source).length, 0);
});

test('CSS protocol-relative URL 不得被當成 line comment', () => {
  const source = '.hero{background:url(//cdn.example.test/hero.webp)} .tiny{font-size:12px}';

  assert.equal(sourceViolations('public/example.css', source).length, 1);
});

test('新增 DOM style 路徑仍接受 inherit、initial 與 unset', () => {
  const safe = [
    "el.style.font='inherit';",
    "el.style['fontSize']='initial';",
    "Object.assign(el.style,{fontSize:'unset'});",
    "const style=el.style; style.setProperty('font-size','inherit');",
  ];

  assert.deepEqual(
    safe.map((source) => sourceViolations('public/example.js', source).length),
    [0, 0, 0, 0],
  );
});

test('三語 member profile inputs 明確宣告 1rem', () => {
  const results = ['public/member.html', 'public/en/member.html', 'public/ja/member.html'].map((relative) => {
    const source = readFileSync(path.join(ROOT, relative), 'utf8');
    const drawer = source.match(/<div class="m-drawer" id="m-profile-drawer"[\s\S]*?<\/div>/)?.[0] ?? '';
    const inputs = [...drawer.matchAll(/<input\b[^>]*>/gi)].map((match) => match[0]);
    return [relative, inputs.length, inputs.every((input) => /style="[^"]*font-size\s*:\s*1rem/i.test(input))];
  });

  assert.deepEqual(results, [
    ['public/member.html', 3, true],
    ['public/en/member.html', 3, true],
    ['public/ja/member.html', 3, true],
  ]);
});

test('三語 founding roster 必須維持 aria-hidden', () => {
  const assertHiddenRoster = (source) => {
    const rosters = [...source.matchAll(/<[^>]+\bclass=(['"])([^'"]*)\1[^>]*>/gi)]
      .filter((match) => match[2].split(/\s+/).includes('fnd-roster'))
      .map((match) => match[0]);
    assert.ok(rosters.length > 0);
    for (const roster of rosters) {
      assert.match(roster, /\baria-hidden\s*=\s*(['"])true\1/i);
    }
  };

  for (const relative of ['public/fellow/index.html', 'public/en/fellow/index.html', 'public/ja/fellow/index.html']) {
    const source = readFileSync(path.join(ROOT, relative), 'utf8');
    assert.doesNotThrow(() => assertHiddenRoster(source), relative);
    const mutated = source.replace(/(<div class="fnd-roster")\s+aria-hidden="true"/, '$1');
    assert.notEqual(mutated, source, relative);
    assert.throws(() => assertHiddenRoster(mutated), undefined, relative);
    const duplicated = source.replace(
      /(<div class="fnd-roster" aria-hidden="true">)/,
      '$1<div class="fnd-roster"></div>',
    );
    assert.notEqual(duplicated, source, relative);
    assert.throws(() => assertHiddenRoster(duplicated), undefined, relative);
  }
});

test('roster 例外只遮罩第一個合法 .52rem 與 .42rem 宣告', () => {
  const source = withoutAllowedDecoration(
    'public/fellow/founding.css',
    withoutComments('public/fellow/founding.css', `
      .fnd-roster i{font-size:.52rem;color:red}
      @media(max-width:640px){.fnd-roster i{font-size:.42rem}}
      .fnd-roster i{font-size:.1rem}
      .fnd-roster i{font-size:.52rem}
      .meaningful,.fnd-roster i{font-size:.5rem}
      .meaningful,/* } .fnd-roster i{font-size:.52rem} */.fnd-roster i{font-size:.4rem}
    `),
  );
  const remaining = [...source.matchAll(/font-size\s*:\s*([^;}]+)/gi)].map((match) => match[1].trim());

  assert.deepEqual(remaining, ['.1rem', '.52rem', '.5rem', '.4rem']);
  assert.equal(remaining.every(belowFloor), true);
});

test('正式官網不得宣告低於 16px 的有意義文字', () => {
  const violations = [];
  for (const file of walk(PUBLIC)) {
    if (!EXTENSIONS.has(path.extname(file))) continue;
    const relative = path.relative(ROOT, file).split(path.sep).join('/');
    if (EXCLUDED.has(relative)) continue;

    violations.push(...sourceViolations(relative, readFileSync(file, 'utf8')));
  }

  assert.deepEqual(violations, [], `低於 16px 的字級：\n${violations.join('\n')}`);
});
