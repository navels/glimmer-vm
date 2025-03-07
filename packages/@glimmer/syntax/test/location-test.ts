 
import type { Dict } from '@glimmer/interfaces';
import { src } from '@glimmer/syntax';
import { unwrap } from '@glimmer/util';

 
const test = QUnit.test;

const cases: Dict<[string, number | null][]> = {
  'hello world': [
    ['1:0', 0],
    ['1:5', 5],
    ['1:11', 11],
    ['1:12', null],
    ['2:0', null],
  ],
  'hello world\n': [
    ['1:0', 0],
    ['1:5', 5],
    ['1:11', 11],
    ['1:12', null],
    ['2:0', null],
  ],
  'hello world\n\n': [
    ['1:0', 0],
    ['1:5', 5],
    ['1:11', 11],
    ['1:12', null],
    ['2:0', 12],
    ['2:1', null],
    ['3:0', null],
  ],
  'hello world\ngoodbye world': [
    ['1:0', 0],
    ['1:5', 5],
    ['1:11', 11],
    ['1:12', null],
    ['2:0', 12],
    ['2:7', 19],
    ['2:13', 25],
    ['2:14', null],
    ['3:0', null],
  ],
  'hello world\ngoodbye world\n': [
    ['1:0', 0],
    ['1:5', 5],
    ['1:11', 11],
    ['1:12', null],
    ['2:0', 12],
    ['2:7', 19],
    ['2:13', 25],
    ['2:14', null],
    ['3:0', null],
  ],
};

QUnit.module('locations - position');

for (const [string, testCase] of Object.entries(cases)) {
  let source = new src.Source(string);

  for (let [span, offset] of testCase) {
    let [line, column] = span.split(':').map((i) => parseInt(i, 10));

    if (offset === null) continue;

    test(`${string} @ ${offset} -> ${line}:${column}`, (assert) => {
      assert.deepEqual(source.hbsPosFor(unwrap(offset)), { line, column });
    });
  }
}

QUnit.module('locations - location');

for (const [string, testCase] of Object.entries(cases)) {
  let source = new src.Source(string);

  for (let [span, offset] of testCase) {
    let [line, column] = span.split(':').map((i) => parseInt(i, 10)) as [number, number];

    if (offset === null) continue;

    test(`${string} @ ${line}:${column} -> ${String(offset)}`, (assert) => {
      assert.deepEqual(source.offsetFor(line, column).offset, offset);
    });
  }
}
