import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

describe('Menu Data Schema', () => {
  it('data/menu.json tồn tại và có đầy đủ 8 danh mục Jollibee', () => {
    assert.ok(fs.existsSync('data/menu.json'), 'data/menu.json phải tồn tại');
    const raw = fs.readFileSync('data/menu.json', 'utf8');
    const data = JSON.parse(raw);
    assert.ok(Array.isArray(data.categories), 'categories phải là mảng');
    assert.equal(data.categories.length, 8, 'phải có đúng 8 danh mục');
  });

  it('các sản phẩm combo có cấu trúc option_groups hợp lệ', () => {
    const raw = fs.readFileSync('data/menu.json', 'utf8');
    const data = JSON.parse(raw);
    const combos = data.categories.flatMap(c => c.products).filter(p => p.is_combo);
    assert.ok(combos.length > 0, 'phải có sản phẩm combo');
    const sample = combos[0];
    assert.ok(Array.isArray(sample.option_groups), 'option_groups phải là mảng');
    assert.ok(sample.option_groups.length > 0, 'combo phải có ít nhất 1 nhóm option');
    assert.ok(sample.option_groups[0].group_name, 'phải có tên nhóm group_name');
    assert.ok(Array.isArray(sample.option_groups[0].options), 'options trong nhóm phải là mảng');
  });

  it('config.js định nghĩa window.JOLLIBEE_CONFIG với đầy đủ thuộc tính', () => {
    assert.ok(fs.existsSync('config.js'), 'config.js phải tồn tại');
    const content = fs.readFileSync('config.js', 'utf8');
    assert.ok(content.includes('window.JOLLIBEE_CONFIG'));
    assert.ok(content.includes('discountStep'));
    assert.ok(content.includes('discountPerStep'));
    assert.ok(content.includes('freeshipThreshold'));
    assert.ok(content.includes('standardShippingFee'));
  });
});
