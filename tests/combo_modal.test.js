import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createComboState } from '../js/components/combo-modal.js';

describe('Combo State Logic', () => {
  const mockProduct = {
    id: 'combo_1',
    name: 'Combo Gà Sốt Cay',
    price: 90000,
    option_groups: [
      {
        group_id: 'g1',
        group_name: 'CHỌN GÀ 1',
        options: [
          { option_id: 'opt1', name: 'Gà sốt cay', extra_price: 0 },
          { option_id: 'opt2', name: 'Gà giòn vui vẻ', extra_price: 0 }
        ]
      },
      {
        group_id: 'g2',
        group_name: 'CHỌN NƯỚC',
        options: [
          { option_id: 'opt3', name: 'Nước ngọt vừa', extra_price: 0 },
          { option_id: 'opt4', name: 'Nước ngọt lớn (Up)', extra_price: 4000 }
        ]
      }
    ]
  };

  it('khởi tạo mặc định chọn option đầu tiên của mỗi nhóm', () => {
    const state = createComboState(mockProduct);
    assert.equal(state.selected['g1'].option_id, 'opt1');
    assert.equal(state.selected['g2'].option_id, 'opt3');
    assert.equal(state.getTotalPrice(), 90000);
  });

  it('thay đổi option có phụ thu sẽ tính lại giá tức thì', () => {
    const state = createComboState(mockProduct);
    state.selectOption('g2', mockProduct.option_groups[1].options[1]); // chọn upsize +4k
    assert.equal(state.getTotalPrice(), 94000);
  });

  it('xuất mảng selected options đầy đủ cho giỏ hàng', () => {
    const state = createComboState(mockProduct);
    state.selectOption('g2', mockProduct.option_groups[1].options[1]);
    const selectedList = state.getSelectedList();
    assert.equal(selectedList.length, 2);
    assert.equal(selectedList[1].option_name, 'Nước ngọt lớn (Up)');
    assert.equal(selectedList[1].extra_price, 4000);
  });

  it('nhóm Thêm Sốt có lựa chọn mặc định là Không thêm (none) với giá 0đ', () => {
    const mockComboWithSauce = {
      id: 'combo_sauce',
      name: 'Combo Có Sốt',
      price: 100000,
      option_groups: [
        {
          group_id: 'g_sauce',
          group_name: 'Thêm Sốt',
          is_required: false,
          options: [
            { option_id: 'none_g_sauce', name: 'Không thêm', extra_price: 0, is_default: true },
            { option_id: 'sauce_1', name: 'Thêm 2 Gói Tương Cà', extra_price: 1000, is_default: false }
          ]
        }
      ]
    };
    const state = createComboState(mockComboWithSauce);
    assert.equal(state.selected['g_sauce'].name, 'Không thêm');
    assert.equal(state.getTotalPrice(), 100000);
    // Khi để Không thêm, getSelectedList không đưa vào list phụ thu
    assert.equal(state.getSelectedList().length, 0);

    // Khi khách chủ động chọn thêm tương cà
    state.selectOption('g_sauce', mockComboWithSauce.option_groups[0].options[1]);
    assert.equal(state.getTotalPrice(), 101000);
    assert.equal(state.getSelectedList().length, 1);
    assert.equal(state.getSelectedList()[0].option_name, 'Thêm 2 Gói Tương Cà');
  });
});
