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

  it('các nhóm tùy chọn (Thêm món, Thêm sốt) luôn mặc định là Không thêm (None) 0đ', () => {
    const raw = fs.readFileSync('data/menu.json', 'utf8');
    const data = JSON.parse(raw);
    const combos = data.categories.flatMap(c => c.products).filter(p => p.is_combo);
    
    combos.forEach(combo => {
      (combo.option_groups || []).forEach(group => {
        const title = group.group_name.toLowerCase();
        if (title.startsWith('thêm') || !group.is_required) {
          const defaultOpt = group.options.find(o => o.is_default);
          assert.ok(defaultOpt, `Nhóm tùy chọn ${group.group_name} trong ${combo.name} phải có option mặc định`);
          assert.equal(defaultOpt.extra_price, 0, `Option mặc định của nhóm tùy chọn ${group.group_name} phải có giá 0đ`);
          assert.ok(defaultOpt.name.toLowerCase().includes('không thêm'), `Option mặc định của ${group.group_name} phải là Không thêm`);
        }
      });
    });
  });

  it('mọi combo đều có base_price và tổng (base_price + option mặc định) khớp 100% với giá niêm yết combo', () => {
    const raw = fs.readFileSync('data/menu.json', 'utf8');
    const data = JSON.parse(raw);
    const combos = data.categories.flatMap(c => c.products).filter(p => p.is_combo);
    
    combos.forEach(combo => {
      assert.ok(combo.base_price !== undefined, `Combo ${combo.name} phải có base_price`);
      let defaultExtra = 0;
      (combo.option_groups || []).forEach(group => {
        const def = group.options.find(o => o.is_default);
        if (def) defaultExtra += Number(def.extra_price) || 0;
      });
      const expectedTotal = combo.base_price + defaultExtra;
      assert.equal(expectedTotal, combo.price, `Combo ${combo.name} có base_price (${combo.base_price}) + defaultExtra (${defaultExtra}) phải bằng đúng price niêm yết (${combo.price})`);
    });
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
